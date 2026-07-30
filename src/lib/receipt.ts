import { currency } from "@/lib/banks";

export type ReceiptTxn = {
  id: string;
  description: string;
  amount: number;
  direction: string;
  status: string;
  category: string;
  created_at: string;
};

const LABELS: Record<string, string> = {
  zelle: "Zelle payment",
  paypal: "PayPal transfer",
  chime: "Chime transfer",
  cashapp: "Cash App transfer",
  external_transfer: "Transfer to other bank",
  internal_transfer: "Internal transfer",
  disbursement: "Loan disbursement",
};

export const categoryLabel = (c: string) =>
  LABELS[c] ?? c.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());

export async function receiptJpegBlob(t: ReceiptTxn): Promise<Blob> {
  const W = 900;
  const H = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // header band
  ctx.fillStyle = "#0c2074";
  ctx.fillRect(0, 0, W, 170);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px Helvetica, Arial, sans-serif";
  ctx.fillText("U.S. Bank", 60, 80);
  ctx.font = "26px Helvetica, Arial, sans-serif";
  ctx.fillText("Transaction receipt", 60, 122);

  // amount
  ctx.fillStyle = "#111827";
  ctx.font = "bold 76px Helvetica, Arial, sans-serif";
  const sign = t.direction === "credit" ? "+" : "−";
  ctx.fillText(`${sign}${currency(Number(t.amount))}`, 60, 300);

  ctx.fillStyle = "#6b7280";
  ctx.font = "28px Helvetica, Arial, sans-serif";
  ctx.fillText(categoryLabel(t.category), 60, 348);

  const rows: [string, string][] = [
    ["Description", t.description],
    ["Status", t.status.replace(/^\w/, (m) => m.toUpperCase())],
    ["Type", t.direction === "credit" ? "Credit" : "Debit"],
    ["Date", new Date(t.created_at).toLocaleString()],
    ["Reference", t.id.slice(0, 18).toUpperCase()],
  ];

  let y = 430;
  rows.forEach(([k, v]) => {
    ctx.strokeStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.moveTo(60, y - 40);
    ctx.lineTo(W - 60, y - 40);
    ctx.stroke();

    ctx.fillStyle = "#6b7280";
    ctx.font = "26px Helvetica, Arial, sans-serif";
    ctx.fillText(k, 60, y);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 26px Helvetica, Arial, sans-serif";
    const text = v.length > 34 ? `${v.slice(0, 33)}…` : v;
    const w = ctx.measureText(text).width;
    ctx.fillText(text, W - 60 - w, y);
    y += 90;
  });

  ctx.strokeStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.moveTo(60, y - 40);
  ctx.lineTo(W - 60, y - 40);
  ctx.stroke();

  ctx.fillStyle = "#6b7280";
  ctx.font = "22px Helvetica, Arial, sans-serif";
  ctx.fillText("Member FDIC · Equal Housing Lender", 60, H - 90);
  ctx.fillText("This receipt is confirmation of your transaction.", 60, H - 54);

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92),
  );
}

export async function shareReceipt(t: ReceiptTxn) {
  const blob = await receiptJpegBlob(t);
  return await saveImage(blob, `receipt-${t.id.slice(0, 8)}.jpg`);
}

/* ----------------------------- JPEG receipts ----------------------------- */

export type ReceiptDetails = {
  amount: number;
  category: string;
  recipient: string;
  from: string;
  date: Date;
  reference: string;
  status?: string;
  delivery?: string;
};

export async function receiptDetailsJpegBlob(d: ReceiptDetails): Promise<Blob> {
  const W = 900;
  const H = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#0c2074";
  ctx.fillRect(0, 0, W, 170);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px Helvetica, Arial, sans-serif";
  ctx.fillText("U.S. Bank", 60, 80);
  ctx.font = "26px Helvetica, Arial, sans-serif";
  ctx.fillText("Transfer receipt", 60, 122);

  ctx.fillStyle = "#111827";
  ctx.font = "bold 76px Helvetica, Arial, sans-serif";
  ctx.fillText(`−${currency(d.amount)}`, 60, 300);

  ctx.fillStyle = "#6b7280";
  ctx.font = "28px Helvetica, Arial, sans-serif";
  ctx.fillText(categoryLabel(d.category), 60, 348);

  const rows: [string, string][] = [
    ["Recipient", d.recipient],
    ["From account", d.from],
    ["Status", d.status ?? "Completed"],
    ["Delivery", d.delivery ?? "—"],
    ["Date", d.date.toLocaleString()],
    ["Reference", d.reference],
  ];

  let y = 430;
  rows.forEach(([k, v]) => {
    ctx.strokeStyle = "#e5e7eb";
    ctx.beginPath();
    ctx.moveTo(60, y - 40);
    ctx.lineTo(W - 60, y - 40);
    ctx.stroke();

    ctx.fillStyle = "#6b7280";
    ctx.font = "26px Helvetica, Arial, sans-serif";
    ctx.fillText(k, 60, y);

    ctx.fillStyle = "#111827";
    ctx.font = "bold 26px Helvetica, Arial, sans-serif";
    const text = v.length > 34 ? `${v.slice(0, 33)}…` : v;
    const w = ctx.measureText(text).width;
    ctx.fillText(text, W - 60 - w, y);
    y += 90;
  });

  ctx.strokeStyle = "#e5e7eb";
  ctx.beginPath();
  ctx.moveTo(60, y - 40);
  ctx.lineTo(W - 60, y - 40);
  ctx.stroke();

  ctx.fillStyle = "#6b7280";
  ctx.font = "22px Helvetica, Arial, sans-serif";
  ctx.fillText("Member FDIC · Equal Housing Lender", 60, H - 90);
  ctx.fillText("This receipt is confirmation of your transaction.", 60, H - 54);

  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92),
  );
}

export type SaveResult = "shared" | "downloaded" | "opened";

/**
 * Saves an image on any device. On phones the native share sheet is used first
 * so the receipt can be saved straight to the photo gallery; desktop and
 * browsers without file sharing fall back to a normal download, and sandboxed
 * environments that block downloads fall back to opening the image in a new
 * tab (long-press -> Save image).
 */
export async function saveImage(
  blob: Blob,
  filename: string,
): Promise<SaveResult> {
  const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
  const nav = navigator as Navigator & {
    canShare?: (d: { files?: File[] }) => boolean;
  };

  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "Transaction receipt" });
      return "shared";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "shared";
      // fall through to download
    }
  }

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    const supportsDownload = "download" in a;
    if (supportsDownload) {
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      a.target = "_self";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return "downloaded";
    }
    const win = window.open(url, "_blank");
    if (!win) {
      window.location.href = url;
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return "opened";
  } catch {
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return "opened";
  }
}

export async function downloadReceiptJpeg(d: ReceiptDetails) {
  const blob = await receiptDetailsJpegBlob(d);
  return await saveImage(blob, `receipt-${d.reference.toLowerCase()}.jpg`);
}

export async function downloadTxnReceiptJpeg(t: ReceiptTxn) {
  const blob = await receiptJpegBlob(t);
  return await saveImage(blob, `receipt-${t.id.slice(0, 8)}.jpg`);
}


export function txnReceiptDetails(t: ReceiptTxn, from = "—"): ReceiptDetails {
  return {
    amount: Number(t.amount),
    category: t.category,
    recipient: t.description,
    from,
    date: new Date(t.created_at),
    reference: t.id.slice(0, 18).toUpperCase(),
    status: t.status.replace(/^\w/, (m) => m.toUpperCase()),
  };
}
