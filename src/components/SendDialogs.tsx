import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { US_BANKS, currency, MIN_TRANSFER_AMOUNT, MIN_TRANSFER_LABEL } from "@/lib/banks";
import { downloadReceiptJpeg, type ReceiptDetails } from "@/lib/receipt";
import {
  PinField,
  validPin,
  ContactWithdrawalTeam,
} from "@/components/WithdrawalPin";

async function saveReceipt(details: ReceiptDetails) {
  try {
    const result = await downloadReceiptJpeg(details);
    if (result === "downloaded") toast.success("Receipt saved as JPEG");
    if (result === "opened")
      toast.info("Receipt opened — press and hold the image to save it");
  } catch {
    toast.error("Could not create the receipt");
  }
}

const reference = () =>
  `TXN${Date.now().toString(36).toUpperCase()}`;


type Account = {
  id: string;
  name: string;
  kind: string;
  is_primary: boolean;
  account_number: string;
  balance: number;
};

type DialogProps = {
  accounts: Account[];
  primaryId?: string;
  onClose: () => void;
  onDone: () => void;
};

const digits = (s: string) => s.replace(/\D/g, "");
const validRouting = (s: string) => /^\d{9}$/.test(s);
const validAccountNumber = (s: string) => /^\d{4,17}$/.test(s);
const mask = (s: string) => `••••${s.slice(-4)}`;

function ReviewRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium text-foreground">{v}</dd>
    </div>
  );
}

function FromAccountField({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>From account</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select account" />
        </SelectTrigger>
        <SelectContent>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name} — {currency(Number(a.balance))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ------------------------------ Zelle flow ------------------------------ */

const ZELLE_PURPLE = "#6D1ED4";

export function ZelleDialog({ accounts, primaryId, onClose, onDone }: DialogProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [from, setFrom] = useState(primaryId ?? "");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");

  const value = Number(amount);
  const validAmount = Number.isFinite(value) && value >= MIN_TRANSFER_AMOUNT;
  const source = accounts.find((a) => a.id === from);
  const canReview = !!from && validAmount && !!name.trim() && !!contact.trim();

  async function send() {
    setBusy(true);
    const { error } = await supabase.rpc("send_money", {
      _from: from,
      _amount: value,
      _category: "zelle",
      _recipient: `${name.trim()} (${contact.trim()})`,
      _pin: pin,
    });
    setBusy(false);
    if (error) {
      toast.error("Zelle payment failed", { description: error.message });
      return;
    }
    const details = {
      amount: value,
      category: "zelle",
      recipient: `${name.trim()} (${contact.trim()})`,
      from: source ? `${source.name} ${source.account_number}` : "—",
      date: new Date(),
      reference: reference(),
      delivery: "Typically within minutes",
    };
    toast.success("Sent with Zelle", {
      description: `${currency(value)} sent to ${name.trim()}. Tap to save your receipt.`,
      duration: 10000,
      action: {
        label: "Save receipt",
        onClick: () => void saveReceipt(details),
      },
    });
    onClose();

    onDone();
  }


  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-sm">
        <div
          className="px-6 py-5 text-white"
          style={{ backgroundColor: ZELLE_PURPLE }}
        >
          <DialogHeader>
            <DialogTitle className="text-white">
              <span className="text-2xl font-extrabold lowercase italic tracking-tight">
                zelle
              </span>
              <span className="align-super text-xs">®</span>
            </DialogTitle>
            <DialogDescription className="text-white/85">
              {step === 1
                ? "Who are you sending money to?"
                : "Review your payment"}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 pb-6">
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label htmlFor="zelle-name">Recipient name</Label>
                <Input
                  id="zelle-name"
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zelle-contact">
                  Email or U.S. mobile number
                </Label>
                <Input
                  id="zelle-contact"
                  maxLength={120}
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zelle-amount">Amount (USD)</Label>
                <Input
                  id="zelle-amount"
                  type="number"
                  min={MIN_TRANSFER_AMOUNT}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum transfer amount is {MIN_TRANSFER_LABEL}.
                </p>
              </div>
              <FromAccountField
                accounts={accounts}
                value={from}
                onChange={setFrom}
              />
              <Button
                className="w-full text-white hover:opacity-90"
                style={{ backgroundColor: ZELLE_PURPLE }}
                disabled={!canReview}
                onClick={() => setStep(2)}
              >
                Review
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-xl border bg-surface p-5">
                <p className="text-center text-4xl font-bold text-foreground">
                  {currency(value)}
                </p>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  to{" "}
                  <span className="font-medium text-foreground">
                    {name.trim()}
                  </span>
                </p>
                <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
                  <ReviewRow k="Send to" v={contact.trim()} />
                  <ReviewRow
                    k="From"
                    v={
                      source
                        ? `${source.name} ${source.account_number}`
                        : ""
                    }
                  />
                  <ReviewRow k="Delivery" v="Typically within minutes" />
                </dl>
              </div>
              <PinField id="zelle-pin" value={pin} onChange={setPin} />
              <ContactWithdrawalTeam />
              <Button
                className="w-full text-white hover:opacity-90"
                style={{ backgroundColor: ZELLE_PURPLE }}
                disabled={busy || !validPin(pin)}
                onClick={send}
              >
                {busy ? "Sending…" : `Send ${currency(value)}`}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Linked external account flows (Chime / Cash App / banks) ---------------- */

export type LinkedKind = "chime" | "cashapp" | "external";

const BRANDS: Record<
  LinkedKind,
  {
    title: string;
    tag: string;
    color: string | null;
    category: string;
    bankMode: "input" | "select";
    defaultBank: string;
    needsAccountName: boolean;
    delivery: string;
    success: string;
  }
> = {
  chime: {
    title: "chime",
    tag: "Link an external account to send money",
    color: "#1EC677",
    category: "chime",
    bankMode: "input",
    defaultBank: "Chime",
    needsAccountName: false,
    delivery: "Typically within minutes",
    success: "Chime transfer sent",
  },
  cashapp: {
    title: "Cash App",
    tag: "Link a Cash App account to send money",
    color: "#00D632",
    category: "cashapp",
    bankMode: "input",
    defaultBank: "Cash App",
    needsAccountName: false,
    delivery: "Typically within minutes",
    success: "Cash App transfer sent",
  },
  external: {
    title: "Send to other banks",
    tag: "Link a U.S. bank account",
    color: null,
    category: "external_transfer",
    bankMode: "select",
    defaultBank: "",
    needsAccountName: true,
    delivery: "1–3 business days",
    success: "Bank transfer sent",
  },
};

export function LinkedAccountDialog({
  kind,
  accounts,
  primaryId,
  onClose,
  onDone,
}: DialogProps & { kind: LinkedKind }) {
  const brand = BRANDS[kind];
  const [step, setStep] = useState<1 | 2>(1);
  const [from, setFrom] = useState(primaryId ?? "");
  const [bank, setBank] = useState(brand.defaultBank);
  const [routing, setRouting] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");

  const value = Number(amount);
  const validAmount = Number.isFinite(value) && value >= MIN_TRANSFER_AMOUNT;
  const source = accounts.find((a) => a.id === from);

  const routingDigits = digits(routing);
  const accountDigits = digits(accountNumber);
  const bankOk = brand.bankMode === "select" ? !!bank : !!bank.trim();
  const canReview =
    !!from &&
    validAmount &&
    bankOk &&
    validRouting(routingDigits) &&
    validAccountNumber(accountDigits) &&
    (!brand.needsAccountName || !!accountName.trim());

  const recipient =
    kind === "external"
      ? `${accountName.trim()} · ${bank} · acct ${mask(accountDigits)}`
      : `${bank.trim()} account ${mask(accountDigits)}`;

  async function send() {
    setBusy(true);
    const { error } = await supabase.rpc("send_money", {
      _from: from,
      _amount: value,
      _category: brand.category,
      _recipient: recipient,
      _pin: pin,
    });
    setBusy(false);
    if (error) {
      toast.error("Transfer failed", { description: error.message });
      return;
    }
    const details = {
      amount: value,
      category: brand.category,
      recipient,
      from: source ? `${source.name} ${source.account_number}` : "—",
      date: new Date(),
      reference: reference(),
      delivery: brand.delivery,
    };
    toast.success(brand.success, {
      description: `${currency(value)} sent to ${recipient}. Tap to save your receipt.`,
      duration: 10000,
      action: {
        label: "Save receipt",
        onClick: () => void saveReceipt(details),
      },
    });
    onClose();
    onDone();
  }


  const brandButton = brand.color
    ? { backgroundColor: brand.color, color: "#fff" }
    : undefined;

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        <div
          className={
            brand.color
              ? "px-6 py-5 text-white"
              : "bg-primary px-6 py-5 text-primary-foreground"
          }
          style={brand.color ? { backgroundColor: brand.color } : undefined}
        >
          <DialogHeader>
            <DialogTitle
              className={brand.color ? "text-white" : "text-primary-foreground"}
            >
              {brand.title}
            </DialogTitle>
            <DialogDescription
              className={
                brand.color ? "text-white/85" : "text-primary-foreground/85"
              }
            >
              {step === 1 ? brand.tag : "Review your transfer"}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-4 px-6 pb-6">
          {step === 1 && (
            <>
              {brand.bankMode === "select" ? (
                <div className="space-y-2">
                  <Label>Receiving bank</Label>
                  <Select value={bank} onValueChange={setBank}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a U.S. bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_BANKS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor={`${kind}-bank`}>Bank name</Label>
                  <Input
                    id={`${kind}-bank`}
                    maxLength={60}
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    placeholder="Bank name"
                  />
                </div>
              )}

              {brand.needsAccountName && (
                <div className="space-y-2">
                  <Label htmlFor={`${kind}-acct-name`}>Account holder name</Label>
                  <Input
                    id={`${kind}-acct-name`}
                    maxLength={100}
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Jane Doe"
                  />
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${kind}-routing`}>Routing number</Label>
                  <Input
                    id={`${kind}-routing`}
                    inputMode="numeric"
                    maxLength={9}
                    value={routing}
                    onChange={(e) => setRouting(digits(e.target.value))}
                    placeholder="9 digits"
                  />
                  {routing && !validRouting(routingDigits) && (
                    <p className="text-xs text-destructive">
                      Routing number must be 9 digits.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${kind}-acct`}>Account number</Label>
                  <Input
                    id={`${kind}-acct`}
                    inputMode="numeric"
                    maxLength={17}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(digits(e.target.value))}
                    placeholder="Account number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`${kind}-amount`}>Amount (USD)</Label>
                <Input
                  id={`${kind}-amount`}
                  type="number"
                  min={MIN_TRANSFER_AMOUNT}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                />
                <p className="text-xs text-muted-foreground">
                  Minimum transfer amount is {MIN_TRANSFER_LABEL}.
                </p>
              </div>

              <FromAccountField
                accounts={accounts}
                value={from}
                onChange={setFrom}
              />

              <Button
                className="w-full hover:opacity-90"
                style={brandButton}
                disabled={!canReview}
                onClick={() => setStep(2)}
              >
                Review
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-xl border bg-surface p-5">
                <p className="text-center text-4xl font-bold text-foreground">
                  {currency(value)}
                </p>
                <p className="mt-2 text-center text-sm text-muted-foreground">
                  to{" "}
                  <span className="font-medium text-foreground">
                    {kind === "external" ? accountName.trim() : bank.trim()}
                  </span>
                </p>
                <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
                  <ReviewRow k="Bank" v={bank.trim()} />
                  {brand.needsAccountName && (
                    <ReviewRow k="Account name" v={accountName.trim()} />
                  )}
                  <ReviewRow k="Account number" v={mask(accountDigits)} />
                  <ReviewRow k="Routing number" v={routingDigits} />
                  <ReviewRow
                    k="From"
                    v={source ? `${source.name} ${source.account_number}` : ""}
                  />
                  <ReviewRow k="Delivery" v={brand.delivery} />
                </dl>
              </div>
              <PinField id={`${kind}-pin`} value={pin} onChange={setPin} />
              <ContactWithdrawalTeam />
              <Button
                className="w-full hover:opacity-90"
                style={brandButton}
                disabled={busy || !validPin(pin)}
                onClick={send}
              >
                {busy ? "Sending…" : `Send ${currency(value)}`}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setStep(1)}
              >
                Back
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
