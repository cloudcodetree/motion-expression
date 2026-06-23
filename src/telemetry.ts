// Lightweight structured telemetry. In dev, every event is POSTed as JSON to the
// dev server, which appends it to .dev-telemetry.jsonl for querying/replay. In
// the production build this is a no-op (import.meta.env.DEV is false), so it adds
// nothing to shipped bytes' behavior. Upgrade path: swap the sink for an
// OpenTelemetry exporter once a backend/collector exists.

// Session id so events from one page-load group together. Math.random is fine in
// the browser; the value only needs to be unique-ish per session.
const SID = Math.random().toString(36).slice(2, 8);

export function track(type: string, payload: Record<string, unknown> = {}): void {
  if (!import.meta.env.DEV) return;
  const event = { sid: SID, t: Math.round(performance.now()), type, ...payload };
  try {
    void fetch('/__telemetry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
  } catch {
    /* best-effort: never let telemetry break the app */
  }
}
