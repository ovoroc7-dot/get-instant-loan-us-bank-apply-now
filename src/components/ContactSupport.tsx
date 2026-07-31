import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Headset, Mail, MessageSquare, Phone } from "lucide-react";
import { useState } from "react";

export const SUPPORT_PHONE = "+1-985-602-3749";
export const SUPPORT_EMAIL = "Shellymurray074@gmail.com";

function supportTelHref() {
  return `tel:${SUPPORT_PHONE.replace(/[^\d+]/g, "")}`;
}

function supportMailHref(subject: string, body: string) {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

/** Contact cards for phone and email support. */
export function ContactSupportCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <a
        href={supportTelHref()}
        className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-accent/5"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
          <Phone className="h-5 w-5 text-accent" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Call us</p>
          <p className="text-sm text-muted-foreground">{SUPPORT_PHONE}</p>
        </div>
      </a>

      <a
        href={supportMailHref("Support enquiry", "Hi, I need help with my account.")}
        className="group flex items-center gap-4 rounded-xl border bg-card p-4 shadow-[var(--shadow-card)] transition-colors hover:bg-accent/5"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/10">
          <Mail className="h-5 w-5 text-accent" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Email us</p>
          <p className="text-sm text-muted-foreground">{SUPPORT_EMAIL}</p>
        </div>
      </a>
    </div>
  );
}

/** Full support section with contact cards and an enquiry/complaint form. */
export function ContactSupport() {
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || !message.trim()) {
      toast.error("Please fill in the subject and message.");
      return;
    }
    window.location.href = supportMailHref(topic, message);
    toast.success("Opening your email app…", {
      description: "Send the message to our support team.",
    });
  }

  return (
    <div className="space-y-6">
      <ContactSupportCards />

      <form
        onSubmit={submit}
        className="rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]"
      >
        <div className="mb-4 flex items-center gap-2">
          <Headset className="h-5 w-5 text-accent" />
          <h3 className="font-semibold text-foreground">Send an enquiry or complaint</h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="support-topic">Subject</Label>
            <Input
              id="support-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Loan disbursement question"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-message">Message</Label>
            <Textarea
              id="support-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe your enquiry or complaint in detail…"
              rows={4}
              required
            />
          </div>
          <Button type="submit" className="w-full">
            <MessageSquare className="mr-2 h-4 w-4" />
            Email support team
          </Button>
        </div>
      </form>
    </div>
  );
}
