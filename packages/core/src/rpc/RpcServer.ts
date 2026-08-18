import { isRpcResult } from '../util/rpc.ts'
import { markStopTokenStopped } from '../util/stopToken.ts'
import {
  bufferPaths,
  containerEntries,
  explainTransferError,
} from './explainTransferError.ts'
import { serializeError } from './serializeError/index.ts'

import type { ErrorObject } from './serializeError/index.ts'

// This ESM package builds without @types/node, but consuming bundlers still
// string-replace `process.env.NODE_ENV`, so keep the reference and give it a
// minimal module-scoped type for tsc. Same declaration, for the same reason, as
// plugins/canvas's CanvasFeatureGateMixin.
declare const process: { env: { NODE_ENV?: string } }

interface WorkerSelf {
  postMessage(message: unknown, transfer?: Transferable[]): void
  addEventListener(type: string, listener: (e: MessageEvent) => void): void
}

// `self` is a DedicatedWorkerGlobalScope in the worker, but the DOM lib types the
// ambient `self` as Window (whose postMessage overloads differ), so narrow it to
// the surface RpcServer uses. Absent entirely under plain node.
const workerSelf =
  typeof self === 'undefined' ? undefined : (self as unknown as WorkerSelf)

// The wrapper an RPC method returns to hand transferables to postMessage. `T`
// is the value the caller ultimately receives, so it flows out of an executor's
// return type and gets checked against the method's declared RpcRegistry
// `return` (see RpcMethodType) instead of decaying to `unknown` at the wrapper.
export interface RpcResult<T = unknown> {
  __rpcResult: true
  value: T
  transferables: Transferable[]
}

/**
 * Under test, report a hand-built transfer list that disagrees with the payload
 * it describes. Nothing else checks one, and neither direction shows up as a
 * failure of its own:
 *
 * - a field added to the result and forgotten here is silently STRUCTURE-CLONED,
 *   a copy per fetch of the largest arrays a worker produces;
 * - an entry naming a buffer the payload does not carry detaches something for
 *   nobody, and the throw lands on a later call as a `DataCloneError` naming an
 *   index.
 *
 * A check rather than a derivation, which is the whole reason it is safe to
 * apply to every result at once. Deriving the list would mean transferring
 * whatever a walk finds, and transferring MOVES: `positionOrder` returned a
 * module-level empty result, a wider walk swept it in, and every
 * `hg002_haplotypes_*` figure was unrenderable until it was fixed (2026-08-15).
 * This reports and transfers nothing.
 *
 * Test-only because it walks the payload, which also carries plain data — a
 * `featureIds` array of half a million strings — and `bufferPaths` was written
 * for the error path for exactly that reason. `rpcResultWithArrayBuffers`
 * derives its own list and so cannot disagree with itself; it is checked anyway,
 * since its walk stops one level down and the deeper one here is what would
 * catch a producer that nests further.
 */
function checkTransferList(value: unknown, transferables: Transferable[]) {
  const listed = new Set(transferables.filter(t => t instanceof ArrayBuffer))
  const carried = bufferPaths(value)
  const missing: string[] = []
  for (const [buffer, paths] of carried) {
    // A SharedArrayBuffer cannot be transferred at all, only cloned, so its
    // absence from the list is the correct answer rather than an omission.
    if (buffer instanceof ArrayBuffer && !listed.has(buffer)) {
      missing.push(paths.join(' = '))
    }
  }
  const stray = [...listed].filter(b => !carried.has(b)).length
  if (missing.length > 0 || stray > 0) {
    const parts = [
      missing.length > 0
        ? `not transferred, so structure-cloned: ${missing.join(', ')}`
        : undefined,
      stray > 0
        ? `${stray} transfer-list entr${stray === 1 ? 'y is' : 'ies are'} not in the payload`
        : undefined,
    ].filter(p => p !== undefined)
    throw new Error(
      `RPC transfer list disagrees with its payload — ${parts.join('; ')}`,
    )
  }
}

export function rpcResult<T>(
  value: T,
  transferables: Transferable[],
): RpcResult<T> {
  if (process.env.NODE_ENV === 'test') {
    checkTransferList(value, transferables)
  }
  return { __rpcResult: true, value, transferables }
}

// A buffer postMessage will refuse, and which field it arrived on. `detached` is
// ES2024 and is what a moved buffer reports; the byteLength fallback is for a
// runtime without it, where a detached buffer measures 0 under a view that does
// not.
//
// Worth naming rather than letting postMessage throw: its own message is
// "ArrayBuffer at index N is already detached", and N is a position in a list
// the reader cannot see. One of those cost a figure a release cycle.
function detachedFieldName(view: ArrayBufferView, path: string) {
  const { buffer } = view
  const detached =
    'detached' in buffer
      ? (buffer as { detached: boolean }).detached
      : buffer.byteLength === 0 && view.byteLength > 0
  return detached ? path : undefined
}

// rpcResult with transferables auto-derived from the result's TypedArray fields,
// so a newly-added one is transferred (moved, zero-copy) rather than silently
// structurally cloned just because a hand-maintained buffer list wasn't
// extended. Use for any worker RPC whose result is typed arrays (canvas /
// synteny / dotplot / wiggle packers).
//
// Walks one level into plain-object fields, because a packer that groups its
// arrays (`{ ...featureData, instanceData }`) is otherwise back to maintaining
// the nested half by hand — which is where the bug this guards against lived.
//
// A Map or Set counts as a container, so a matrix keyed by sample name — what
// the wiggle score matrix and the variant genotype matrix return — derives its
// list here rather than looping at the call site. Both had to, because
// `Object.entries` is blank on either.
export function rpcResultWithArrayBuffers<T extends object>(value: T) {
  // A Set because several fields can be views onto one allocation (subarrays of
  // a shared buffer), and postMessage rejects a transfer list with a duplicate
  // entry outright. SharedArrayBuffer-backed views are skipped for the same
  // reason: a SAB can't be transferred, only cloned.
  const transferables = new Set<ArrayBuffer>()
  const detached: string[] = []

  function collect(obj: object, prefix: string, depth: number) {
    for (const [path, field] of containerEntries(obj, prefix)) {
      if (ArrayBuffer.isView(field)) {
        if (field.buffer instanceof ArrayBuffer) {
          const bad = detachedFieldName(field, path)
          if (bad) {
            detached.push(bad)
          }
          transferables.add(field.buffer)
        }
      } else if (
        depth > 0 &&
        field !== null &&
        typeof field === 'object' &&
        !Array.isArray(field)
      ) {
        collect(field, path, depth - 1)
      }
    }
  }
  collect(value, '', 1)

  if (detached.length > 0) {
    throw new Error(
      `RPC result carries already-detached buffer(s): ${detached.join(', ')}. ` +
        'A typed array is being held across calls and re-posted; allocate it per call.',
    )
  }
  return rpcResult(value, [...transferables])
}

type Procedure = (data: unknown) => Promise<unknown>

interface RpcMessageData {
  method: string
  uid: string
  libRpc?: true
  data: unknown
  // a stop-token notification rather than a call: the id of a token the main
  // thread has stopped. Carries no method or uid — it is not scoped to one
  // call, because a token can be in flight on several at once.
  stopToken?: string
}

export default class RpcServer {
  protected methods: Record<string, Procedure>

  private self: WorkerSelf

  constructor(methods: Record<string, Procedure>) {
    if (!workerSelf) {
      throw new Error('RpcServer must be constructed in a worker global scope')
    }
    this.methods = methods
    this.self = workerSelf
    this.self.addEventListener('message', (e: MessageEvent) => {
      this.handler(e)
    })
  }

  handler(e: MessageEvent<RpcMessageData>) {
    const { libRpc, method, uid, data, stopToken } = e.data
    if (!libRpc) {
      return
    }
    if (stopToken !== undefined) {
      // Every in-flight method holding this token now sees it as stopped at its
      // next await boundary, and any AbortSignal taken against it aborts, so a
      // canceled read drops off the socket. Handled ahead of the method lookup:
      // this frame has no method name and would otherwise land in the unknown
      // method branch with no uid to reply to.
      markStopTokenStopped(stopToken)
      return
    }
    const methodFn = Object.hasOwn(this.methods, method)
      ? this.methods[method]
      : undefined
    if (methodFn) {
      // wrap so a synchronous throw inside methodFn still routes to .throw()
      ;(async () => methodFn(data))()
        .then(response => {
          this.reply(uid, response, method)
        })
        .catch((error: unknown) => {
          this.throw(uid, serializeError(error))
        })
    } else {
      this.throw(uid, `Unknown RPC method "${method}"`)
    }
  }

  // every outgoing message carries the libRpc tag so the client can tell our
  // frames apart from unrelated worker traffic
  private post(
    payload: Record<string, unknown>,
    transferables: Transferable[],
  ) {
    this.self.postMessage({ ...payload, libRpc: true }, transferables)
  }

  protected reply(uid: string, response: unknown, method?: string) {
    // a renderer may return an rpcResult wrapper carrying transferables for
    // zero-copy; a plain return travels as data with nothing to transfer
    const { value, transferables } = isRpcResult(response)
      ? response
      : { value: response, transferables: [] }
    try {
      this.post({ uid, data: value }, transferables)
    } catch (e) {
      // postMessage blames a transfer-list entry by index alone, into a list
      // assembled by hand here in the worker — so name the method and the field
      // before the error leaves. The method is not otherwise recoverable: the
      // throw happens in a `.then`, so the stack is `post`/`reply` and nothing
      // above them. See explainTransferError; it only runs here.
      this.throw(
        uid,
        serializeError(explainTransferError(e, value, transferables, method)),
      )
    }
  }

  /**
   * The only frame that must never fail to send, because it is the last one: a
   * `throw` that throws leaves the call unsettled, and an unsettled call is a
   * display spinning forever with no error to show. Everything upstream of here
   * routes a failure into this, including {@link reply}'s own catch, so there is
   * nothing left to catch it.
   *
   * It can fail. `serializeError` copies an error's own-enumerable properties so
   * custom data survives the boundary, and it only skips the ones that are
   * *themselves* functions — a property holding an object with a method on it
   * (an arrow-function class field, an adapter, a `cause` that is a `Response`)
   * is copied whole and is not structured-cloneable. So fall back to the
   * message, which by construction is a string.
   */
  protected throw(uid: string, error: ErrorObject | string) {
    try {
      this.post({ uid, error }, [])
    } catch {
      const message = typeof error === 'string' ? error : error.message
      // Never empty. `new Error()` has an empty message, and the client tells an
      // error frame from a reply by which key the frame carries — so an empty
      // one is a rejection the caller cannot read a reason from, and used to be
      // a frame it read as a reply. Naming the error's own class is the most the
      // fallback still has to work with.
      this.post(
        {
          uid,
          error:
            message ||
            `${typeof error === 'string' ? 'Error' : (error.name ?? 'Error')} (no message)`,
        },
        [],
      )
    }
  }

  emit(eventName: string, data: unknown, transferables?: Transferable[]) {
    this.post({ eventName, data }, transferables ?? [])
  }
}
