import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";

// A real, isolated PostgreSQL engine. Only Supabase's auth schema/roles are
// simulated; every public table, policy, function and trigger comes from SQL.
test("migrations, frontend schema, stock transactions and role isolation", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon;
      CREATE ROLE authenticated;
      CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    `);
    const directory = new URL("../supabase/migrations/", import.meta.url);
    const migrations = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
    for (const name of migrations) {
      try {
        await db.exec(await readFile(new URL(name, directory), "utf8"));
      } catch (error) {
        throw new Error(`Migration failed: ${name}: ${error.message}`, { cause: error });
      }
    }
    console.log(`Applied ${migrations.length} migrations to an empty database.`);

    const typeSource = ts.createSourceFile(
      "types.ts",
      await readFile(new URL("../src/integrations/supabase/types.ts", import.meta.url), "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
    const databaseType = typeSource.statements.find(
      (node) => ts.isTypeAliasDeclaration(node) && node.name.text === "Database",
    ).type;
    const member = (node, name) =>
      node.members.find((item) => item.name?.getText(typeSource).replaceAll('"', "") === name)
        ?.type;
    const publicType = member(databaseType, "public");
    const tables = member(publicType, "Tables");
    const views = member(publicType, "Views");
    const columns = (
      await db.query(
        "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public'",
      )
    ).rows;
    for (const tableName of new Set(columns.map((column) => column.table_name))) {
      const definition = member(tables, tableName) ?? member(views, tableName);
      assert.ok(definition, `Database relation missing from TypeScript: ${tableName}`);
      const actual = columns
        .filter((column) => column.table_name === tableName)
        .map((column) => column.column_name)
        .sort();
      const declared = member(definition, "Row")
        .members.map((column) => column.name.getText(typeSource).replaceAll('"', ""))
        .sort();
      assert.deepEqual(declared, actual, `Database columns differ from TypeScript: ${tableName}`);
    }
    for (const fn of member(publicType, "Functions").members) {
      const name = fn.name.getText(typeSource).replaceAll('"', "");
      const rows = (
        await db.query(
          "SELECT proargnames FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=$1",
          [name],
        )
      ).rows;
      assert.equal(rows.length, 1, `Stale/missing typed RPC: ${name}`);
      const args = member(fn.type, "Args");
      const names =
        args.members?.map((arg) => arg.name.getText(typeSource).replaceAll('"', "")).sort() ?? [];
      assert.deepEqual(names, (rows[0].proargnames ?? []).sort(), `RPC argument mismatch: ${name}`);
    }

    const routes = new URL("../src/routes/", import.meta.url);
    const sources = await Promise.all(
      (await readdir(routes))
        .filter((name) => name.endsWith(".tsx"))
        .map((name) => readFile(new URL(name, routes), "utf8")),
    );
    const relations = new Set(
      sources.flatMap((source) =>
        [...source.matchAll(/\.from\("([a-z_]+)"\)/g)].map((match) => match[1]),
      ),
    );
    for (const relation of relations) {
      const result = await db.query("SELECT to_regclass($1) AS relation", [`public.${relation}`]);
      assert.ok(result.rows[0].relation, `Missing frontend relation: ${relation}`);
    }
    const functions = new Set(
      sources.flatMap((source) =>
        [...source.matchAll(/\.rpc\("([a-z_]+)"/g)].map((match) => match[1]),
      ),
    );
    for (const name of functions) {
      const result = await db.query(
        "SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=$1",
        [name],
      );
      assert.equal(result.rows.length, 1, `Missing/ambiguous frontend RPC: ${name}`);
    }

    const owner = "10000000-0000-0000-0000-000000000001";
    const worker = "10000000-0000-0000-0000-000000000002";
    const branch = "20000000-0000-0000-0000-000000000001";
    const other = "20000000-0000-0000-0000-000000000002";
    const product = "30000000-0000-0000-0000-000000000001";
    await db.query(
      "INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES ($1,'owner@example.test','{\"full_name\":\"Owner\",\"business_name\":\"Test Agro\"}'),($2,'worker@example.test','{}')",
      [owner, worker],
    );
    const roles = await db.query(
      "SELECT user_id, role, is_primary_owner FROM public.user_roles ORDER BY user_id",
    );
    assert.equal(roles.rows[0].role, "owner");
    assert.equal(roles.rows[0].is_primary_owner, true);
    assert.equal(roles.rows[1].role, "manager");
    assert.equal(
      (await db.query("SELECT business_name FROM profiles WHERE id=$1", [owner])).rows[0]
        .business_name,
      "Test Agro",
    );
    await db.query("INSERT INTO branches(id,name) VALUES ($1,'Main'),($2,'Other')", [
      branch,
      other,
    ]);
    await db.query("UPDATE user_roles SET branch_id=$1 WHERE user_id=$2", [branch, worker]);
    await db.query(
      "INSERT INTO products(id,name,category,buying_price,selling_price) VALUES ($1,'Seed','imbuto',100,150)",
      [product],
    );
    const asUser = async (id) => {
      await db.exec("RESET ROLE");
      await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [id]);
      await db.exec("SET ROLE authenticated");
    };
    await asUser(owner);
    await db.query(
      "INSERT INTO purchases(branch_id,product_id,quantity,buying_price,transport_cost,supplier) VALUES ($1,$2,20,100,0,'Supplier')",
      [branch, product],
    );
    assert.equal(
      Number(
        (await db.query("SELECT quantity FROM inventory WHERE branch_id=$1", [branch])).rows[0]
          .quantity,
      ),
      20,
    );
    await asUser(worker);
    assert.equal((await db.query("SELECT id FROM branches")).rows.length, 1);
    assert.equal((await db.query("SELECT id FROM products")).rows.length, 0);
    assert.equal((await db.query("SELECT id FROM worker_products")).rows.length, 1);
    const sale =
      "SELECT create_sale($1,$2,$3,1,(timezone('Africa/Kigali',now()))::date,$4,NULL) AS id";
    await db.query(sale, [branch, product, 2, "Customer"]);
    const posted = (await db.query("SELECT selling_price,profit,created_by FROM sales")).rows[0];
    assert.equal(Number(posted.selling_price), 150, "Database must enforce catalog price");
    assert.equal(Number(posted.profit), 100);
    assert.equal(posted.created_by, worker);
    await assert.rejects(db.query(sale, [branch, product, 999, "Rollback customer"]));
    assert.equal(
      (await db.query("SELECT id FROM customers WHERE name='Rollback customer'")).rows.length,
      0,
      "Failed sales must roll back customer creation",
    );
    await assert.rejects(db.query(sale, [other, product, 1, "Wrong branch"]));
    await assert.rejects(
      db.query("SELECT transfer_stock($1,$2,$3,1,'Unauthorized')", [branch, other, product]),
    );
    await assert.rejects(
      db.query("SELECT adjust_stock($1,$2,50,'Unauthorized')", [branch, product]),
    );
    await assert.rejects(db.query("DELETE FROM sales"));
    await asUser(owner);
    await db.query("SELECT transfer_stock($1,$2,$3,3,'Restock')", [branch, other, product]);
    assert.equal(
      Number(
        (await db.query("SELECT quantity FROM inventory WHERE branch_id=$1", [branch])).rows[0]
          .quantity,
      ),
      15,
    );
    assert.equal(
      Number(
        (await db.query("SELECT quantity FROM inventory WHERE branch_id=$1", [other])).rows[0]
          .quantity,
      ),
      3,
    );
    await db.query("UPDATE branches SET status=false WHERE id=$1", [other]);
    await assert.rejects(
      db.query("SELECT transfer_stock($1,$2,$3,1,'Inactive')", [branch, other, product]),
    );
    await assert.rejects(db.query(sale, [other, product, 1, "Inactive sale"]));
    await assert.rejects(
      db.query("UPDATE user_roles SET role='manager' WHERE user_id=$1", [owner]),
    );
    assert.ok((await db.query("SELECT id FROM audit_log")).rows.length > 0);
    await db.query("SELECT delete_worker($1)", [worker]);
    assert.equal(
      (await db.query("SELECT user_id FROM user_roles WHERE user_id=$1", [worker])).rows.length,
      0,
    );
    assert.equal(
      (await db.query("SELECT created_by FROM sales")).rows[0].created_by,
      null,
      "Removing a worker must retain sales history",
    );
    await assert.rejects(db.query("DELETE FROM products WHERE id=$1", [product]));
    await db.query("UPDATE products SET status=false WHERE id=$1", [product]);
    assert.equal(
      (await db.query("SELECT id FROM sales WHERE product_id=$1", [product])).rows.length,
      1,
    );
    assert.equal(
      Number(
        (
          await db.query("SELECT quantity FROM inventory WHERE branch_id=$1 AND product_id=$2", [
            branch,
            product,
          ])
        ).rows[0].quantity,
      ),
      15,
    );
    await assert.rejects(db.query(sale, [branch, product, 1, "Inactive product"]));
    const unusedProduct = "30000000-0000-0000-0000-000000000099";
    await db.query(
      "INSERT INTO products(id,name,category,buying_price,selling_price,unit) VALUES ($1,'Unused','imbuto',100,150,'kg')",
      [unusedProduct],
    );
    await db.query("DELETE FROM products WHERE id=$1", [unusedProduct]);
    assert.equal(
      (await db.query("SELECT id FROM products WHERE id=$1", [unusedProduct])).rows.length,
      0,
    );
    await db.query(
      "INSERT INTO products(id,name,category,buying_price,selling_price,unit) VALUES ($1,'Stock only','imbuto',100,150,'kg')",
      [unusedProduct],
    );
    await db.exec("RESET ROLE");
    await db.query(
      "INSERT INTO inventory(branch_id,product_id,quantity,avg_cost) VALUES ($1,$2,5,100)",
      [branch, unusedProduct],
    );
    await asUser(owner);
    await assert.rejects(db.query("DELETE FROM products WHERE id=$1", [unusedProduct]));
    assert.equal(
      Number(
        (await db.query("SELECT quantity FROM inventory WHERE product_id=$1", [unusedProduct]))
          .rows[0].quantity,
      ),
      5,
    );
    const emptyBranch = "20000000-0000-0000-0000-000000000003";
    await db.query("INSERT INTO branches(id,name) VALUES ($1,'Empty branch')", [emptyBranch]);
    await db.query("DELETE FROM branches WHERE id=$1", [emptyBranch]);
    assert.equal(
      (await db.query("SELECT id FROM branches WHERE id=$1", [emptyBranch])).rows.length,
      0,
    );
    // A full previous calendar year remains readable, including records beyond
    // the API's usual 1,000-row cap. All fixtures live in this isolated database.
    const priorYear = new Date().getFullYear() - 1;
    const yearStart = `${priorYear}-01-01`;
    const yearEnd = `${priorYear}-12-31`;
    await db.query("UPDATE products SET status=true WHERE id=$1", [product]);
    await db.query(
      "INSERT INTO purchases(branch_id,product_id,quantity,buying_price,transport_cost,supplier,purchase_date) VALUES ($1,$2,1500,100,0,'Annual fixture',$3)",
      [branch, product, yearStart],
    );
    await db.query(
      `INSERT INTO sales(branch_id,product_id,quantity,selling_price,sale_date,customer_name)
       SELECT $1,$2,1,150,$3::date + (i % 365),'Annual fixture'
       FROM generate_series(0,1204) AS i`,
      [branch, product, yearStart],
    );
    await db.query(
      `INSERT INTO expenses(branch_id,description,amount,expense_date)
       SELECT $1,'Annual fixture',100,make_date($2,i,1) FROM generate_series(1,12) AS i`,
      [branch, priorYear],
    );
    const annualRows = [];
    for (let offset = 0; ; offset += 500) {
      const page = await db.query(
        "SELECT id,quantity,selling_price FROM sales WHERE sale_date >= $1 AND sale_date <= $2 ORDER BY sale_date DESC,id LIMIT 500 OFFSET $3",
        [yearStart, yearEnd, offset],
      );
      if (!page.rows.length) break;
      annualRows.push(...page.rows);
    }
    assert.equal(annualRows.length, 1205);
    assert.equal(new Set(annualRows.map((row) => row.id)).size, 1205);
    assert.equal(
      annualRows.reduce(
        (total, row) => total + Number(row.quantity) * Number(row.selling_price),
        0,
      ),
      180750,
    );
    assert.equal(
      Number(
        (
          await db.query(
            "SELECT sum(amount) AS total FROM expenses WHERE expense_date BETWEEN $1 AND $2",
            [yearStart, yearEnd],
          )
        ).rows[0].total,
      ),
      1200,
    );
    assert.equal(
      Number(
        (
          await db.query(
            "SELECT sum(quantity*buying_price+transport_cost) AS total FROM purchases WHERE purchase_date BETWEEN $1 AND $2",
            [yearStart, yearEnd],
          )
        ).rows[0].total,
      ),
      150000,
    );
    assert.equal(
      (
        await db.query(
          "SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname LIKE '%_report_%_idx'",
        )
      ).rows.length,
      6,
    );
    console.log(
      "Verified prior-year reporting with 1,205 sales, 12 months of expenses, and six reporting indexes.",
    );
    console.log(
      `Verified ${relations.size} frontend relations and ${functions.size} RPCs, owner bootstrap, RLS, atomic sales and transfers.`,
    );
  } finally {
    await db.close();
  }
});
