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

/**
 * Every payload field each transferred buffer is reachable by.
 *
 * Walks the value being sent — own properties, plus one level into plain-object
 * children, which covers every RPC result shape in the tree (a flat bag of typed
 * arrays, or that plus a nested `instanceData` / `attributes` record).
 *
 * Several fields can name one buffer, so this collects all of them rather than
 * the first: subarrays of a shared allocation are exactly how a duplicate entry
 * gets into a hand-built list, and naming both ends is what makes that
 * actionable.
 */
function bufferPaths(value: unknown) {
  const paths = new Map<ArrayBufferLike, string[]>()
  const visit = (node: unknown, prefix: string, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 2) {
      return
    }
    for (const [key, child] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key
      const buffer = ArrayBuffer.isView(child)
        ? child.buffer
        : child instanceof ArrayBuffer
          ? child
          : undefined
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
  // the walk is a courtesy, not a contract — a buffer it cannot reach still has
  // to be reported as something other than silence
  const at = fields ?? 'not reachable from the payload'
  const first = transferables.indexOf(entry)
  const detail =
    first < index
      ? `index ${index} repeats index ${first} — one allocation, reached by ${at}`
      : `index ${index} is ${at}`

  const annotated = new Error(`${error.message} — ${detail}`)
  // the throw site and the browser's own error name, both of which a plain
  // rethrow would drop
  annotated.stack = error.stack
  annotated.name = error.name
  return annotated
}
