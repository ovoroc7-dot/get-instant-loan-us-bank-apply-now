import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { currency } from "@/lib/banks";

type LoanLike = { id: string; amount: number | string; status: string };

const SEEN_KEY = "loan-approval-notified";

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function supported() {
  return typeof window !== "undefined" && "Notification" in window;
}

function fireNotification(title: string, body: string) {
  if (!supported() || Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      icon: "/icon-512.png",
      badge: "/icon-512.png",
      tag: "loan-approval",
      requireInteraction: true,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
    if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* notification unavailable */
  }
}

/**
 * Fires a phone/desktop notification-bar alert the moment a borrower's loan
 * flips to "approved". Each loan only alerts once per device.
 */
export function useLoanApprovalAlerts(loans: LoanLike[]) {
  const seen = useRef<string[] | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (seen.current === null) seen.current = readSeen();

    const fresh = loans.filter(
      (l) => l.status === "approved" && !seen.current!.includes(l.id),
    );
    if (fresh.length === 0) return;

    for (const l of fresh) {
      const amount = currency(Number(l.amount));
      fireNotification(
        "Loan approved 🎉",
        `Your loan officer approved your ${amount} personal loan. The funds have been disbursed to your primary checking account.`,
      );
      toast.success("Loan approved", {
        description: `${amount} has been disbursed to your primary checking account.`,
        duration: 10000,
      });
    }

    seen.current = [...seen.current!, ...fresh.map((l) => l.id)];
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen.current));
  }, [loans]);
}

/** Prompts the borrower to allow phone notifications for loan decisions. */
export function LoanAlertOptIn() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "default",
  );

  useEffect(() => {
    setPermission(supported() ? Notification.permission : "unsupported");
  }, []);

  if (permission !== "default") return null;

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          Turn on phone alerts to be notified the instant a loan officer approves
          your loan.
        </p>
      </div>
      <Button
        size="sm"
        onClick={async () => {
          const result = await Notification.requestPermission();
          setPermission(result);
          if (result === "granted") {
            fireNotification(
              "Alerts turned on",
              "We'll notify you here the moment your loan is approved.",
            );
          } else {
            toast.error("Notifications blocked", {
              description:
                "Allow notifications for this site in your browser settings to get loan alerts.",
            });
          }
        }}
      >
        Enable alerts
      </Button>
    </div>
  );
}