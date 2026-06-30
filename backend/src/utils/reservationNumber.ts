// Gut lesbare Reservierungsnummer (ohne verwechselbare Zeichen 0/O/1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReservationNumber(prefix = "LUM"): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `${prefix}-${s}`;
}
