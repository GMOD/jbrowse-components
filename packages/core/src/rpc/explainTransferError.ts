// `postMessage` addresses a bad transfer-list entry by index and nothing else.
// Measured in a real worker (Chrome 152), which is where these are read:
//
//   ArrayBuffer at index 19 is already detached.
//   ArrayBuffer at index 2 is a duplicate of an earlier ArrayBuffer.
//   Value at index 0 does not have a transferable type.
//
// So it names the CAUSE, in its own words, and separates the three. What it
// never names is the FIELD — and the list is assembled by hand at each call
// site, so acting on "index 19" means re-deriving that list's layout from
// source. The synteny list's layout moves with the track's attribute-channel
// count, so that answer is not even stable across tracks. Supplying the field
// is the whole job here; do not re-derive the cause, which is already in the
// sentence this appends to.
//
// Only runs on the error path.

// The deepest RPC result in the tree is the alignments one: `{ groups }`, an
// array of groups each holding its arrays under `data`, so a buffer sits at
// `groups.3.data.mismatchStarts` — three containers down. The synteny result is
// two (`instanceData.bp1`, `attributes.identity`) and most are one. The walk is
// capped rather than unbounded because a payload also carries plain data — a
// featureIds array of half a million strings — and there is no reason to
// descend past where buffers are known to live.
//
// A cap that is too SHORT fails silently and expensively: it reports the blamed
// entry as "not in the payload", which reads as a bug in the transfer list. That
// is how this number was found to be wrong, so it is stated with the shape it
// has to cover rather than left as a bare 2.
const MAX_DEPTH = 3

// The allocation a payload node names, whether it is a view or the buffer.
function bufferOf(node: unknown) {
  return ArrayBuffer.isView(node)
    ? node.buffer
    : node instanceof ArrayBuffer
      ? node
      : undefined
}

/**
 * Every payload field each transferred buffer is reachable by.
 *
 * Several fields can name one buffer, so this collects all of them rather than
 * the first: subarrays of a shared allocation are exactly how a duplicate entry
 * gets into a hand-built list, and naming both ends is what makes that
 * actionable.
 */
export function bufferPaths(value: unknown) {
  const paths = new Map<ArrayBufferLike, string[]>()
  const seen = new WeakSet<object>()
  const visit = (node: unknown, prefix: string, depth: number) => {
    if (!node || typeof node !== 'object' || depth > MAX_DEPTH) {
      return
    }
    // A result can BE a buffer rather than hold one — `rpcResult(buf, [buf])`.
    // Without this the root has no fields to walk, so the entry blamed by index
    // reads as "not in the payload", which is the one wording that sends the
    // reader looking for a list bug that isn't there.
    const root = bufferOf(node)
    if (root) {
      paths.set(root, [...(paths.get(root) ?? []), prefix || '<result>'])
      return
    }
    // structuredClone accepts a cyclic payload, so the walk over one has to
    // terminate on its own
    if (seen.has(node)) {
      return
    }
    seen.add(node)
    for (const [key, child] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key
      const buffer = bufferOf(child)
      if (buffer) {
        paths.set(buffer, [...(paths.get(buffer) ?? []), path])
      } else {
        visit(child, path, depth + 1)
      }
    }
  }
  visit(value, '', 0)
  return paths
}

/**
 * The error to send when `postMessage` rejects a reply, with the transfer-list
 * entry it blamed named by field.
 *
 * Returns the original error untouched when the message addresses no index: an
 * unserializable payload ("() => {} could not be cloned") reports that way and
 * has nothing to do with the transfer list, so a report about transfers would
 * point at the wrong thing entirely.
 */
export function explainTransferError(
  error: unknown,
  value: unknown,
  transferables: readonly Transferable[],
  method?: string,
) {
  if (!(error instanceof Error)) {
    return error
  }
  const index = Number(/ at index (\d+)/.exec(error.message)?.[1])
  const entry = transferables[index]
  if (entry === undefined) {
    return error
  }

  const paths = bufferPaths(value)
  const fields = (
    entry instanceof ArrayBuffer ? paths.get(entry) : undefined
  )?.join(', ')
  // A buffer the walk cannot reach is reported with the two counts, because
  // together they say which of the two things went wrong: "n-1 of n" means the
  // list names a buffer the result does not carry — the transfer is giving away
  // something the worker still owns, which is a bug in the list and not in the
  // walk. A low count means the payload is a shape this walk does not cover, and
  // the layout has to come from source after all.
  const reachable = transferables.filter(
    t => t instanceof ArrayBuffer && paths.has(t),
  ).length
  const at =
    fields ??
    `not in the payload (${reachable} of ${transferables.length} entries are)`
  const first = transferables.indexOf(entry)
  const detail =
    first < index
      ? `index ${index} repeats index ${first} — one allocation, reached by ${at}`
      : `index ${index} is ${at}`

  // Which method built the list is the other half of "which field", and it is
  // not on the stack: the post happens in a `.then` off the method's promise,
  // so the trace is `post` / `reply` and nothing above.
  const where = method ? `${method}: ` : ''
  const annotated = new Error(`${error.message} — ${where}${detail}`)
  // the throw site and the browser's own error name, both of which a plain
  // rethrow would drop
  annotated.stack = error.stack
  annotated.name = error.name
  return annotated
}
