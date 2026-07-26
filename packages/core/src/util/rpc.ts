// straight from the defining module, not the librpc barrel that re-exports it:
// RpcServer.ts imports this file, so going through the barrel would loop
import type { RpcResult } from '../rpc/RpcServer.ts'

/**
 * Type guard to check if a value is an RpcResult.
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
    value.__rpcResult === true
  )
}
