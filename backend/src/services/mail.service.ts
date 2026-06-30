import nodemailer, { type Transporter } from "nodemailer";
import { config } from "../config";

/**
 * E-Mail-Versand (SMTP, provider-neutral).
 *
 * Entwurfsgrundsätze:
 *  - Optional: Ohne SMTP-Konfiguration wird der Versand sauber übersprungen,
 *    Buchungen funktionieren weiter (kein harter Abbruch).
 *  - Robust: Versandfehler dürfen eine Reservierung niemals scheitern lassen —
 *    deshalb fängt sendReservationEmails alle Fehler selbst ab und wirft nie.
 *  - Sicher: Alle Gast-Eingaben werden HTML-escaped; Header-Werte werden von
 *    Zeilenumbrüchen befreit (Defense-in-Depth gegen Header-Injection).
 */

interface ReservationMail {
  reservationNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  guestCount: number;
  notes: string | null;
}

let transporter: Transporter | null = null;

function getTransport(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
    });
  }
  return transporter;
}

/** HTML-Sonderzeichen maskieren — verhindert Markup-Injection in der Mail. */
function esc(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Zeilenumbrüche aus Header-Werten (Betreff/Name) entfernen. */
function header(s: string): string {
  return String(s).replace(/[\r\n]+/g, " ").trim();
}

/** "2026-06-30" -> "30.06.2026". Bei unerwartetem Format unverändert lassen. */
function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

function guestConfirmation(r: ReservationMail) {
  const name = `${r.firstName} ${r.lastName}`.trim();
  const when = `${formatDate(r.date)} um ${r.time} Uhr`;
  const subject = header(`Ihre Reservierung bei ${config.mail.restaurantName} — ${formatDate(r.date)}, ${r.time} Uhr`);

  const text = [
    `Hallo ${name},`,
    ``,
    `vielen Dank für Ihre Reservierung bei ${config.mail.restaurantName}.`,
    `Wir freuen uns auf Ihren Besuch.`,
    ``,
    `Reservierungsnummer: ${r.reservationNumber}`,
    `Datum & Uhrzeit:     ${when}`,
    `Personen:            ${r.guestCount}`,
    r.notes ? `Ihre Anmerkung:      ${r.notes}` : ``,
    ``,
    `Bitte sagen Sie uns Bescheid, falls Sie nicht kommen können.`,
    ``,
    `Herzliche Grüße`,
    config.mail.restaurantName,
  ]
    .filter((l) => l !== null && l !== undefined)
    .join("\n");

  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#f6f6f4;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <h1 style="font-size:20px;margin:0 0 4px;">Reservierung bestätigt</h1>
    <p style="margin:0 0 20px;color:#555;">${esc(config.mail.restaurantName)}</p>
    <p style="margin:0 0 16px;">Hallo ${esc(name)},<br>vielen Dank für Ihre Reservierung. Wir freuen uns auf Ihren Besuch.</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
      <tr><td style="padding:8px 0;color:#777;">Reservierungsnummer</td><td style="padding:8px 0;text-align:right;font-weight:600;">${esc(r.reservationNumber)}</td></tr>
      <tr><td style="padding:8px 0;color:#777;border-top:1px solid #eee;">Datum &amp; Uhrzeit</td><td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #eee;">${esc(when)}</td></tr>
      <tr><td style="padding:8px 0;color:#777;border-top:1px solid #eee;">Personen</td><td style="padding:8px 0;text-align:right;font-weight:600;border-top:1px solid #eee;">${esc(String(r.guestCount))}</td></tr>
      ${r.notes ? `<tr><td style="padding:8px 0;color:#777;border-top:1px solid #eee;">Ihre Anmerkung</td><td style="padding:8px 0;text-align:right;border-top:1px solid #eee;">${esc(r.notes)}</td></tr>` : ``}
    </table>
    <p style="margin:0;color:#777;font-size:13px;">Bitte sagen Sie uns Bescheid, falls Sie nicht kommen können.</p>
  </div></body></html>`;

  return { subject, text, html };
}

function restaurantNotification(r: ReservationMail) {
  const name = `${r.firstName} ${r.lastName}`.trim();
  const subject = header(
    `Neue Reservierung: ${formatDate(r.date)}, ${r.time} Uhr — ${r.guestCount} Pers. (${name})`,
  );

  const text = [
    `Neue Reservierung eingegangen:`,
    ``,
    `Nummer:    ${r.reservationNumber}`,
    `Datum:     ${formatDate(r.date)} um ${r.time} Uhr`,
    `Personen:  ${r.guestCount}`,
    `Gast:      ${name}`,
    `E-Mail:    ${r.email}`,
    `Telefon:   ${r.phone}`,
    r.notes ? `Anmerkung: ${r.notes}` : ``,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `<!doctype html><html lang="de"><body style="margin:0;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
  <div style="max-width:520px;margin:0 auto;padding:24px;">
    <h1 style="font-size:18px;margin:0 0 16px;">Neue Reservierung</h1>
    <table style="width:100%;border-collapse:collapse;">
      <tr><td style="padding:6px 0;color:#777;">Nummer</td><td style="padding:6px 0;text-align:right;font-weight:600;">${esc(r.reservationNumber)}</td></tr>
      <tr><td style="padding:6px 0;color:#777;border-top:1px solid #eee;">Datum &amp; Uhrzeit</td><td style="padding:6px 0;text-align:right;font-weight:600;border-top:1px solid #eee;">${esc(`${formatDate(r.date)} um ${r.time} Uhr`)}</td></tr>
      <tr><td style="padding:6px 0;color:#777;border-top:1px solid #eee;">Personen</td><td style="padding:6px 0;text-align:right;font-weight:600;border-top:1px solid #eee;">${esc(String(r.guestCount))}</td></tr>
      <tr><td style="padding:6px 0;color:#777;border-top:1px solid #eee;">Gast</td><td style="padding:6px 0;text-align:right;border-top:1px solid #eee;">${esc(name)}</td></tr>
      <tr><td style="padding:6px 0;color:#777;border-top:1px solid #eee;">E-Mail</td><td style="padding:6px 0;text-align:right;border-top:1px solid #eee;">${esc(r.email)}</td></tr>
      <tr><td style="padding:6px 0;color:#777;border-top:1px solid #eee;">Telefon</td><td style="padding:6px 0;text-align:right;border-top:1px solid #eee;">${esc(r.phone)}</td></tr>
      ${r.notes ? `<tr><td style="padding:6px 0;color:#777;border-top:1px solid #eee;">Anmerkung</td><td style="padding:6px 0;text-align:right;border-top:1px solid #eee;">${esc(r.notes)}</td></tr>` : ``}
    </table>
  </div></body></html>`;

  return { subject, text, html };
}

/**
 * Verschickt Gast-Bestätigung und (falls konfiguriert) Restaurant-Benachrichtigung.
 * Fire-and-forget: wirft nie — Fehler werden geloggt, die Buchung bleibt bestehen.
 */
export async function sendReservationEmails(r: ReservationMail): Promise<void> {
  if (!config.mail.enabled || !config.mail.from) {
    console.info("[mail] Versand übersprungen (nicht konfiguriert) für", r.reservationNumber);
    return;
  }

  const tx = getTransport();
  const from = config.mail.from;

  try {
    const g = guestConfirmation(r);
    await tx.sendMail({ from, to: r.email, subject: g.subject, text: g.text, html: g.html });
    console.info("[mail] Gast-Bestätigung gesendet an", r.email, "für", r.reservationNumber);
  } catch (e) {
    console.error("[mail] Gast-Bestätigung fehlgeschlagen für", r.reservationNumber, e);
  }

  if (config.mail.notifyTo) {
    try {
      const n = restaurantNotification(r);
      await tx.sendMail({
        from,
        to: config.mail.notifyTo,
        replyTo: r.email,
        subject: n.subject,
        text: n.text,
        html: n.html,
      });
      console.info("[mail] Restaurant-Benachrichtigung gesendet für", r.reservationNumber);
    } catch (e) {
      console.error("[mail] Restaurant-Benachrichtigung fehlgeschlagen für", r.reservationNumber, e);
    }
  }
}
