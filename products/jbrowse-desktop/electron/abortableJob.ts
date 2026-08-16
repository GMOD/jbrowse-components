/**
 * Run `work` under an `AbortController` the renderer can reach by `jobId`, and
 * forget the job however it ends.
 *
 * The registry is the caller's, so each handler registration keeps its own and
 * a second app window doesn't share one. Passing it in rather than closing over
 * a module-level map is also what makes the bookkeeping testable: the `finally`
 * here is the only place a job is removed, so a handler cannot leak one by
 * forgetting to.
 */
export async function runAbortableJob<T>(
  jobs: Map<string, AbortController>,
  jobId: string,
  work: (signal: AbortSignal) => Promise<T>,
) {
  const controller = new AbortController()
  jobs.set(jobId, controller)
  try {
    return await work(controller.signal)
  } finally {
    jobs.delete(jobId)
  }
}
