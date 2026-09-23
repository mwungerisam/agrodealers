import { useEffect, useState } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { localDateInput } from "@/lib/utils";

const REMINDER_HOUR = 18;
const notificationKey = (date: string) => `ufbc-owner-evening-summary:${date}`;

type OwnerEveningReminderProps = {
  salesValue: string;
  salesCount: number;
};

export function OwnerEveningReminder({ salesValue, salesCount }: OwnerEveningReminderProps) {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );

  useEffect(() => {
    if ("Notification" in window) setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (permission !== "granted") return;

    let timer: number | undefined;
    const schedule = () => {
      const now = new Date();
      const target = new Date(now);
      target.setHours(REMINDER_HOUR, 0, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);

      timer = window.setTimeout(
        () => {
          const date = localDateInput();
          if (!localStorage.getItem(notificationKey(date))) {
            new Notification("UFBC Agrodealer — Daily owner summary", {
              body: `${salesCount} sale${salesCount === 1 ? "" : "s"} recorded today. Sales value: ${salesValue}.`,
              icon: "/icon-192.png",
            });
            localStorage.setItem(notificationKey(date), "sent");
          }
          schedule();
        },
        Math.max(target.getTime() - Date.now(), 1_000),
      );
    };

    schedule();
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [permission, salesCount, salesValue]);

  const enable = async () => {
    if (!("Notification" in window)) {
      toast.error("Notifications are not supported by this browser.");
      return;
    }
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
    if (nextPermission === "granted") toast.success("Evening owner summary enabled for 6:00 PM.");
    else toast.error("Notification permission was not granted.");
  };

  if (permission === "unsupported") return null;
  if (permission === "granted") {
    return (
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <CheckCircle2 className="h-4 w-4 text-primary" /> Evening owner summary enabled for 6:00 PM
      </div>
    );
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={() => void enable()} className="h-9">
      <Bell className="mr-2 h-4 w-4" /> Enable evening summary
    </Button>
  );
}
