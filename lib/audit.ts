type DbLike = {
  prepare: (sql: string) => {
    run: (...params: unknown[]) => Promise<unknown>;
  };
};

export async function logAudit(
  db: DbLike,
  action: string,
  entityType: string,
  entityId: number | null,
  actorUserId: number | null,
  detail: string
) {
  await db.prepare(
    'INSERT INTO audit_logs (action, entity_type, entity_id, actor_user_id, detail) VALUES (?, ?, ?, ?, ?)'
  ).run(action, entityType, entityId, actorUserId, detail);
}
