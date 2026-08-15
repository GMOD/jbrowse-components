// `postMessage` names a failing transferable by its INDEX and nothing else:
// "ArrayBuffer at index 19 is already detached". An index into a list the
// caller built by hand is not something anyone can act on — locating it means
// re-deriving the list's length and layout from source, and the layout moves
// whenever a channel count does. So when the post throws, name the entries.
//
// Only runs on the error path.

// True for a buffer some earlier postMessage transferred away. `detached` is
// ES2024 and is the only exact answer; without it a zero byteLength is the
// tell, which a genuinely empty buffer shares — hence "detached or empty",
// because claiming the stronger thing on a guess is how a diagnostic sends the
// next reader somewhere wrong.
function detachedState(buffer: ArrayBufferLike) {
  const exact = (buffer as { detached?: boolean }).detached
  if (typeof exact === 'boolean') {
    return exact ? 'DETACHED' : undefined
  }
  return buffer.byteLength === 0 ? 'detached or empty' : undefined
}

/**
 * Where each transferable sits in the result, so a failure names a field.
 *
 * Walks the value the worker is sending — its own properties, and one level
 * into plain-object children, which is the shape every RPC result in the tree
 * has (a flat bag of typed arrays, or that plus a nested `instanceData` /
 * `attributes` record). A buffer reached by no path is still reported, by
 * index; the walk is a courtesy, not a contract.
 */
function bufferPaths(value: unknown) {
  const paths = new Map<ArrayBufferLike, string>()
  const visit = (node: unknown, prefix: string, depth: number) => {
    if (!node || typeof node !== 'object' || depth > 2) {
      return
    }
    for (const [key, child] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key
      if (ArrayBuffer.isView(child)) {
        // first path wins, so an aliased array reports where it was allocated
        if (!paths.has(child.buffer)) {
          paths.set(child.buffer, path)
        }
      } else if (child instanceof ArrayBuffer) {
        if (!paths.has(child)) {
          paths.set(child, path)
        }
      } else {
        visit(child, path, depth + 1)
      }
    }
  }
  visit(value, '', 0)
  return paths
}

/**
 * The sentence to append to a failed `postMessage`, or undefined when nothing
 * about the transfer list looks wrong (in which case the original error is
 * about the payload, not the transfers, and adding to it would mislead).
 *
 * Distinguishes the two causes, because they have opposite fixes and the
 * browser's message cannot tell them apart:
 *
 * - **A duplicate within this list.** postMessage detaches on the first
 *   occurrence and rejects the second, so it reports "already detached" for
 *   what is really "named twice". Two typed arrays that are subarrays of one
 *   allocation share a `.buffer` and are the usual way in.
 * - **Detached before this call.** Nothing in this list did it, so an earlier
 *   postMessage transferred the same buffer — which means a value survived
 *   between RPC calls, and the adapter cache is where things survive.
 */
export function describeTransferables(
  value: unknown,
  transferables: readonly Transferable[],
) {
  const paths = bufferPaths(value)
  const name = (t: Transferable, i: number) =>
    (t instanceof ArrayBuffer ? paths.get(t) : undefined) ?? `index ${i}`

  const seen = new Map<Transferable, number>()
  const duplicates: string[] = []
  const detached: string[] = []
  for (const [i, t] of transferables.entries()) {
    const first = seen.get(t)
    if (first !== undefined) {
      duplicates.push(
        `${name(t, i)} (index ${i}, same buffer as index ${first})`,
      )
      continue
    }
    seen.set(t, i)
    if (t instanceof ArrayBuffer) {
      const state = detachedState(t)
      if (state) {
        detached.push(`${name(t, i)} (index ${i}, ${state})`)
      }
    }
  }

  const total = transferables.length
  if (duplicates.length) {
    return (
      `${duplicates.length} of ${total} transferables name a buffer already in the list: ` +
      `${duplicates.join(', ')}. postMessage detaches on the first occurrence and rejects ` +
      `the second, so it reports this as "already detached". Two views onto one allocation ` +
      `(a subarray and its parent, or two subarrays of it) share a buffer.`
    )
  }
  if (detached.length) {
    return (
      `${detached.length} of ${total} transferables was already detached before this call: ` +
      `${detached.join(', ')}. Nothing in this list detached it, so an earlier postMessage ` +
      `transferred the same buffer — look for a value that survives between RPC calls, which ` +
      `in a worker means the adapter cache or module state.`
    )
  }
  return undefined
}
