import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QueryState({
  pending,
  error,
  retry,
}: {
  pending?: boolean;
  error?: unknown;
  retry?: () => void;
}) {
  if (!pending && !error) return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-5 text-sm"
    >
      {error ? (
        <AlertCircle className="h-5 w-5 text-destructive" />
      ) : (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      )}
      <span className="flex-1">
        {error
          ? "We could not load this information. Check your connection and try again."
          : "Loading your information…"}
      </span>
      {!!error && retry && (
        <Button variant="outline" size="sm" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
