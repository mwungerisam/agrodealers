export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.17";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      sales_pricing_instruction: {
        Row: { id: boolean; content: string; updated_at: string; updated_by: string | null };
        Insert: { id?: boolean; content: string; updated_at?: string; updated_by?: string | null };
        Update: { id?: boolean; content?: string; updated_at?: string; updated_by?: string | null };
        Relationships: [];
      };
      audit_log: {
        Row: {
          action: string;
          branch_id: string | null;
          created_at: string;
          details: Json | null;
          entity: string;
          entity_id: string | null;
          id: string;
          user_id: string | null;
        };
        Insert: {
          action: string;
          branch_id?: string | null;
          created_at?: string;
          details?: Json | null;
          entity: string;
          entity_id?: string | null;
          id?: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          branch_id?: string | null;
          created_at?: string;
          details?: Json | null;
          entity?: string;
          entity_id?: string | null;
          id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_log_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      branches: {
        Row: {
          address: string | null;
          code: string | null;
          created_at: string;
          id: string;
          name: string;
          phone: string | null;
          status: boolean;
        };
        Insert: {
          address?: string | null;
          code?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          phone?: string | null;
          status?: boolean;
        };
        Update: {
          address?: string | null;
          code?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          phone?: string | null;
          status?: boolean;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          branch_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          phone: string | null;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount: number;
          branch_id: string;
          created_at: string;
          created_by: string | null;
          description: string;
          expense_date: string;
          id: string;
        };
        Insert: {
          amount: number;
          branch_id: string;
          created_at?: string;
          created_by?: string | null;
          description: string;
          expense_date?: string;
          id?: string;
        };
        Update: {
          amount?: number;
          branch_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          expense_date?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory: {
        Row: {
          avg_cost: number;
          branch_id: string;
          product_id: string;
          quantity: number;
          updated_at: string;
        };
        Insert: {
          avg_cost?: number;
          branch_id: string;
          product_id: string;
          quantity?: number;
          updated_at?: string;
        };
        Update: {
          avg_cost?: number;
          branch_id?: string;
          product_id?: string;
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_movements: {
        Row: {
          branch_id: string;
          created_at: string;
          id: string;
          product_id: string;
          quantity: number;
          ref_id: string | null;
          ref_type: string | null;
          type: Database["public"]["Enums"]["movement_type"];
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          id?: string;
          product_id: string;
          quantity: number;
          ref_id?: string | null;
          ref_type?: string | null;
          type: Database["public"]["Enums"]["movement_type"];
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          id?: string;
          product_id?: string;
          quantity?: number;
          ref_id?: string | null;
          ref_type?: string | null;
          type?: Database["public"]["Enums"]["movement_type"];
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movements_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          buying_price: number;
          category: Database["public"]["Enums"]["product_category"];
          created_at: string;
          description: string | null;
          id: string;
          min_stock: number;
          name: string;
          selling_price: number;
          sku: string | null;
          status: boolean;
          unit: string;
        };
        Insert: {
          buying_price: number;
          category: Database["public"]["Enums"]["product_category"];
          created_at?: string;
          description?: string | null;
          id?: string;
          min_stock?: number;
          name: string;
          selling_price: number;
          sku?: string | null;
          status?: boolean;
          unit?: string;
        };
        Update: {
          buying_price?: number;
          category?: Database["public"]["Enums"]["product_category"];
          created_at?: string;
          description?: string | null;
          id?: string;
          min_stock?: number;
          name?: string;
          selling_price?: number;
          sku?: string | null;
          status?: boolean;
          unit?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          business_name: string | null;
          created_at: string;
          full_name: string;
          id: string;
          phone: string | null;
        };
        Insert: {
          business_name?: string | null;
          created_at?: string;
          full_name?: string;
          id: string;
          phone?: string | null;
        };
        Update: {
          business_name?: string | null;
          created_at?: string;
          full_name?: string;
          id?: string;
          phone?: string | null;
        };
        Relationships: [];
      };
      purchases: {
        Row: {
          branch_id: string;
          buying_price: number;
          created_at: string;
          created_by: string | null;
          id: string;
          product_id: string;
          purchase_date: string;
          quantity: number;
          supplier: string;
          transport_cost: number;
        };
        Insert: {
          branch_id: string;
          buying_price: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          product_id: string;
          purchase_date?: string;
          quantity: number;
          supplier: string;
          transport_cost?: number;
        };
        Update: {
          branch_id?: string;
          buying_price?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          product_id?: string;
          purchase_date?: string;
          quantity?: number;
          supplier?: string;
          transport_cost?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchases_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchases_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      sales: {
        Row: {
          branch_id: string;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          id: string;
          product_id: string;
          profit: number;
          quantity: number;
          sale_date: string;
          selling_price: number;
          unit_cost: number;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          id?: string;
          product_id: string;
          profit?: number;
          quantity: number;
          sale_date?: string;
          selling_price: number;
          unit_cost?: number;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          id?: string;
          product_id?: string;
          profit?: number;
          quantity?: number;
          sale_date?: string;
          selling_price?: number;
          unit_cost?: number;
        };
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      sales_targets: {
        Row: {
          branch_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          period_date: string;
          period_type: string;
          target_amount: number;
          user_id: string | null;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          period_date: string;
          period_type: string;
          target_amount: number;
          user_id?: string | null;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          period_date?: string;
          period_type?: string;
          target_amount?: number;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_targets_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          branch_id: string | null;
          created_at: string;
          id: string;
          is_primary_owner: boolean;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          id?: string;
          is_primary_owner?: boolean;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          id?: string;
          is_primary_owner?: boolean;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      worker_products: {
        Row: {
          category: Database["public"]["Enums"]["product_category"] | null;
          created_at: string | null;
          description: string | null;
          id: string | null;
          min_stock: number | null;
          name: string | null;
          selling_price: number | null;
          sku: string | null;
          status: boolean | null;
          unit: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      adjust_stock: {
        Args: {
          p_branch_id: string;
          p_new_quantity: number;
          p_product_id: string;
          p_reason: string;
        };
        Returns: undefined;
      };
      create_sale: {
        Args: {
          p_branch_id: string;
          p_customer_name: string;
          p_customer_phone: string | null;
          p_product_id: string;
          p_quantity: number;
          p_sale_date: string;
          p_selling_price: number;
        };
        Returns: string;
      };
      find_or_create_customer: {
        Args: { p_branch_id: string; p_customer_name: string; p_customer_phone: string | null };
        Returns: string;
      };
      is_primary_owner: { Args: { p_user_id: string }; Returns: boolean };
      current_branch: { Args: never; Returns: string };
      current_role: {
        Args: never;
        Returns: Database["public"]["Enums"]["app_role"];
      };
      delete_worker: { Args: { p_user_id: string }; Returns: undefined };
      ensure_user_role: { Args: never; Returns: Json };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      transfer_stock: {
        Args: {
          p_from_branch: string;
          p_product_id: string;
          p_quantity: number;
          p_reason: string;
          p_to_branch: string;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: "owner" | "manager";
      movement_type: "in" | "out";
      product_category: "ifumbire" | "imbuto";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["owner", "manager"],
      movement_type: ["in", "out"],
      product_category: ["ifumbire", "imbuto"],
    },
  },
} as const;
