/**
 * The per-read identity a fetched result carries, and the one place the string
 * form of it is built.
 *
 * A read's id used to ship as `readIds: string[]` — `` `${adapter.id}-${n}` ``
 * per read, built in the worker and structured-cloned to the main thread. On a
 * 153,677-read window that measured 24.5ms to build and 8.6ms to clone, 33ms
 * total against 2.1ms for the numeric form: about what computing every drawn
 * mismatch costs (`benches/readIds.bench.ts`,
 * `agent-docs/ideas/numeric-read-ids.md`). The clone half is that large because
 * structured clone is priced by object COUNT — 153,677 strings against one
 * transferable.
 *
 * So the result carries `readKeys` instead, and the string is built per lookup
 * rather than per read. Almost nothing wants the string: identity is used as a
 * map key, a dedupe key and a sort tiebreak, all of which a number serves. It
 * escapes as a string only where the id leaves this plugin's arrays —
 * `featureIdUnderMouse` (MST state, saved and restored), the feature-details
 * fetch, and the tooltip — and each of those is one read at a time, because a
 * hover or a click produces exactly one.
 *
 * THE INVARIANT: `readIdPrefix` is defined exactly when `readKeys` is a
 * `Float64Array`, and `` `${readIdPrefix}${readKeys[i]}` `` is then byte-identical
 * to what `feature.id()` returned. `executeRenderAlignmentData` derives the
 * prefix by stripping the record id off a real `id()` and verifying the strip,
 * so the two cannot drift; an adapter whose features carry no `recordId` (SAM,
 * and the PAF/synteny blocks LGVSyntenyDisplay pushes through this pipeline)
 * takes the `string[]` branch and behaves exactly as before.
 *
 * `Float64Array`, not `Uint32Array`: a BAM virtual offset is
 * `(blockStart << 16) | inBlock`, which passes 2^32 on any file over ~64GB and
 * is exact in a double to 2^53.
 */

// A read's identity within one display. Numeric for BAM/CRAM (the record id
// `feature.id()` is built from), the whole id string otherwise.
export type ReadKey = number | string

export type ReadKeys = Float64Array | string[]

export interface ReadIdentity {
  readKeys: ReadKeys
  readIdPrefix: string | undefined
}

/**
 * The read's full `feature.id()` string — what MST state, the details fetch and
 * the tooltip name a read by. Undefined for an out-of-range index, matching the
 * `readIds[i]` reads this replaced.
 */
export function readIdAt(d: ReadIdentity, i: number): string | undefined {
  const key = d.readKeys[i]
  return key === undefined
    ? undefined
    : typeof key === 'number'
      ? `${d.readIdPrefix ?? ''}${key}`
      : key
}

/**
 * A feature's identity key: the number its `id()` is built from when it has one
 * (BAM's `fileOffset`, cram-js's record `uniqueId`), else the id string itself.
 *
 * `recordId` is unique per record within a file, and every feature of one fetch
 * comes from one adapter — `fetchFeaturesFromAdapter` takes a single
 * `adapterConfig` — so within a fetch the number carries the whole identity and
 * the `${adapter.id}-` prefix distinguishes nothing.
 *
 * `??`, not `||`: fileOffset 0 is the first record of a BAM.
 */
export function readKeyOf(feature: {
  id: () => string
  recordId?: number
}): ReadKey {
  return feature.recordId ?? feature.id()
}

/**
 * The prefix for a set of features, or undefined when they have no numeric
 * record id — which is also the signal to keep shipping id strings.
 *
 * Derived from a feature rather than from `adapter.id` on purpose: it is
 * checked against a real `id()`, so a feature class that builds its id some
 * other way falls back to strings instead of silently shipping a wrong prefix.
 * One `id()` per fetch, against one per read.
 */
export function readIdPrefixOf(features: { id: () => string }[]) {
  const f = features[0]
  const recordId = (f as { recordId?: number } | undefined)?.recordId
  if (f === undefined || recordId === undefined) {
    return undefined
  }
  const id = f.id()
  const suffix = `${recordId}`
  return id.endsWith(suffix)
    ? id.slice(0, id.length - suffix.length)
    : undefined
}
