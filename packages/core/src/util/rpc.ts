import type { RpcResult } from './librpc.ts'

/**
 * Whether structuredClone (and the worker postMessage boundary) can carry this
 * value. Functions and Errors cannot, so they must be stripped before sending.
 */
export function isCloneable(thing: unknown) {
  return !(typeof thing === 'function') && !(thing instanceof Error)
}

/**
 * Values that structuredClone handles natively and that must pass through any
 * arg-walking/cloning unchanged: `Object.entries` on them yields `[]`, so naive
 * cloning would collapse them to plain `{}` (e.g. a SharedArrayBuffer-backed
 * stop token would silently stop working, a typed array would lose its data).
 */
export function isStructuredClonePassthrough(thing: object): boolean {
  return (
    thing instanceof File ||
    thing instanceof Blob ||
    thing instanceof ArrayBuffer ||
    // SharedArrayBuffer is not an ArrayBuffer subclass; without this it
    // collapses to {} and SAB-based stop tokens silently stop working
    (typeof SharedArrayBuffer !== 'undefined' &&
      thing instanceof SharedArrayBuffer) ||
    ArrayBuffer.isView(thing) ||
    thing instanceof Date ||
    thing instanceof Map ||
    thing instanceof Set ||
    thing instanceof RegExp
  )
}

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
    (value as RpcResult).__rpcResult
  )
}
