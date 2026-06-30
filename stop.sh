#!/usr/bin/env bash
# Stoppt den Server auf dem angegebenen Port (Standard 4000).
PORT="${1:-4000}"
PID="$(lsof -ti :"$PORT" 2>/dev/null || true)"
if [ -n "$PID" ]; then
  kill $PID && echo "Gestoppt (PID $PID auf Port $PORT)"
else
  echo "Kein Server auf Port $PORT gefunden."
fi
