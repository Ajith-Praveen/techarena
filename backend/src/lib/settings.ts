export interface EventState {
  registrationOpen: boolean;
  orderGeneratedAt: string | null;
  resultsPublishedAt: string | null;
  resultsPublishedBy: string | null;
}

/** SQL predicate that is true while results are unpublished. Used to guard writes atomically. */
export const RESULTS_NOT_PUBLISHED_SQL =
  "NOT EXISTS (SELECT 1 FROM settings WHERE key = 'results_published_at' AND value IS NOT NULL AND value <> '')";

/** SQL predicate that is true while registration is open. */
export const REGISTRATION_OPEN_SQL =
  "COALESCE((SELECT value FROM settings WHERE key = 'registration_open'), '1') = '1'";

export async function getEventState(db: D1Database): Promise<EventState> {
  const { results } = await db.prepare('SELECT key, value FROM settings').all<{ key: string; value: string | null }>();
  const map = new Map(results.map((r) => [r.key, r.value]));
  const nonEmpty = (v: string | null | undefined) => (v ? v : null);
  return {
    registrationOpen: (map.get('registration_open') ?? '1') === '1',
    orderGeneratedAt: nonEmpty(map.get('order_generated_at')),
    resultsPublishedAt: nonEmpty(map.get('results_published_at')),
    resultsPublishedBy: nonEmpty(map.get('results_published_by')),
  };
}

export function setSettingStmt(db: D1Database, key: string, value: string): D1PreparedStatement {
  return db
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, value);
}

export function deleteSettingStmt(db: D1Database, key: string): D1PreparedStatement {
  return db.prepare('DELETE FROM settings WHERE key = ?').bind(key);
}
