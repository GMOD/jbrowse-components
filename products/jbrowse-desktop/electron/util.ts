/**
 * Shared `.catch(logError)` handler for fire-and-forget promises whose only
 * failure handling is logging.
 */
export function logError(e: unknown) {
  console.error(e)
}
