import { computed } from 'mobx'

/**
 * A per-key encode memo over a display's cell map: `encode` runs for a key
 * when its data reference moves, every key re-encodes when `inputs` yields a
 * new identity, and a departed key is dropped. `inputs` runs through a
 * `computed`, so a getter that allocates a fresh object per read re-encodes
 * only when what it read changed.
 *
 * The returned map is a new instance whenever an entry moved and the same one
 * otherwise, so an MST view holding it invalidates its observers exactly when
 * a cell did. `installUpload` runs its `encode` path on this; a display that
 * needs the encoded map itself — for a hit test, an SVG export — holds one in
 * a `.views` closure and hands the installer identity cells.
 */
export function createEncodeMemo<K, Data, Props, Encoded>(
  cells: () => ReadonlyMap<K, Data>,
  inputs: (() => Props) | undefined,
  encode: (data: Data, props: Props, key: K) => Encoded,
): () => ReadonlyMap<K, Encoded> {
  const encoded = new Map<K, Encoded>()
  const encodedFrom = new Map<K, Data>()
  const props = inputs && computed(inputs)
  let lastProps: Props | undefined
  let snapshot: ReadonlyMap<K, Encoded> = encoded
  return () => {
    const current = cells()
    const p = props ? props.get() : (undefined as Props)
    if (p !== lastProps) {
      lastProps = p
      encodedFrom.clear()
    }
    let changed = false
    for (const [key, data] of current) {
      if (encodedFrom.get(key) !== data) {
        encoded.set(key, encode(data, p, key))
        encodedFrom.set(key, data)
        changed = true
      }
    }
    for (const key of encoded.keys()) {
      if (!current.has(key)) {
        encoded.delete(key)
        encodedFrom.delete(key)
        changed = true
      }
    }
    if (changed) {
      snapshot = new Map(encoded)
    }
    return snapshot
  }
}
