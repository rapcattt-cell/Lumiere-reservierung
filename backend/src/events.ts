import { EventEmitter } from "events";

// Einfacher In-Memory-Eventbus für Echtzeit-Updates (SSE).
// Services rufen emitChange() auf, der SSE-Endpunkt streamt an die Clients.
export const bus = new EventEmitter();
bus.setMaxListeners(200);

export interface ChangeEvent {
  entity: "reservation" | "table";
  action: string;
  date?: string;
}

export function emitChange(e: ChangeEvent) {
  bus.emit("change", e);
}
