// Schlanker HTTP-Fehler mit Statuscode, vom zentralen Error-Handler ausgewertet.
export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (m: string, d?: unknown) => new HttpError(400, m, d);
export const unauthorized = (m = "Nicht authentifiziert") => new HttpError(401, m);
export const forbidden = (m = "Keine Berechtigung") => new HttpError(403, m);
export const notFound = (m = "Nicht gefunden") => new HttpError(404, m);
export const conflict = (m: string, d?: unknown) => new HttpError(409, m, d);
