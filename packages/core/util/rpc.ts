import type { RpcResult } from 'librpc-web-mod'

/**
 * Type guard to check if a value is an RpcResult from librpc-web-mod.
 * Used to detect when a renderer has returned pre-serialized data with transferables.
 *
 * Note: Transferables flow only from worker to main thread (in responses),
 * not from main thread to worker. This is because the render results contain
 * ImageBitmaps and ArrayBuffers that benefit from zero-copy transfer.
 */
export function isRpcResult(value: unknown): value is RpcResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__rpcResult' in value &&
    (value as RpcResult).__rpcResult === true
  )
}
