export function isWebWorker() {
  return (
    // @ts-expect-error
    typeof WorkerGlobalScope !== 'undefined' &&
    // @ts-expect-error
    self instanceof WorkerGlobalScope
  )
}
