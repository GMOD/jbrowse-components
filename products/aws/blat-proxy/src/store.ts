/**
 * The persistence this proxy needs, as a narrow port: a spacing lock, a daily
 * counter, and a response cache. Everything that decides policy
 * ({@link ../budget.ts}) is written against this interface and tested with an
 * in-memory implementation, so the only untested code is the DynamoDB adapter
 * that implements it ({@link ./dynamoStore.ts}), which holds no logic.
 */
export interface BlatStore {
  /**
   * Take the single upstream slot if the last call is at least `spacingMs` old.
   * Atomic: two concurrent Lambdas cannot both succeed. `retryAtMs` is when the
   * slot next frees up.
   */
  tryReserveSlot(
    nowMs: number,
    spacingMs: number,
  ): Promise<{ ok: true } | { ok: false; retryAtMs: number }>

  /**
   * Count one call against `day` (a UTC `YYYY-MM-DD` key), refusing at `max`.
   * Atomic, and self-expiring via `expiresAtSeconds`.
   */
  countDaily(
    day: string,
    max: number,
    expiresAtSeconds: number,
  ): Promise<{ ok: true; count: number } | { ok: false }>

  /**
   * The cached body, if one is stored and not yet expired. DynamoDB's TTL
   * sweeper runs on its own schedule (up to 48h late), so expiry is enforced on
   * read rather than trusted to the sweep.
   */
  readCached(key: string, nowSeconds: number): Promise<string | undefined>

  writeCached(
    key: string,
    body: string,
    expiresAtSeconds: number,
  ): Promise<void>

  /**
   * How many upstream calls `day` has spent so far, for the status route.
   */
  readDailyCount(day: string): Promise<number>

  /**
   * An operator-set outage notice, shown by clients before they query. Set and
   * cleared out of band (`aws dynamodb put-item` / `delete-item` on the `notice`
   * item), so a UCSC-side change can be announced without a redeploy.
   */
  readNotice(): Promise<string | undefined>
}
