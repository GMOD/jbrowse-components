export function isWebWorker() {
  return 'WorkerGlobalScope' in globalThis
}
