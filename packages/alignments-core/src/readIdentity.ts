/**
 * The per-read identity a fetched result carries, and the one place the string
 * form of it is built.
 *
 * A read's id used to ship as `readIds: string[]`, built in the worker and
 * structured-cloned to the main thread. On a 153,677-read window that measured
 * 24.5ms to build and 8.6ms to clone, 33ms total against 2.1ms for the numeric
 * form: about what computing every drawn mismatch costs
 * (`benches/readIds.bench.ts`, `agent-docs/ideas/numeric-read-ids.md`). The
 * clone half is that large because structured clone is priced by object COUNT —
 * 153,677 strings against one transferable.
 *
 * So the result carries `readKeys` instead, and the string is built per lookup
 * rather than per read. Almost nothing wants the string: identity is used as a
 * map key, a dedupe key and a sort tiebreak, all of which a number serves. It
 * escapes as a string only where the id leaves this plugin's arrays —
 * `featureIdUnderMouse` (MST state, saved and restored), the feature-details
 * fetch, and the tooltip — and each of those is one read at a time, because a
 * hover or a click produces exactly one.
 *
 * THE INVARIANT: `` `${readKeys[i]}` `` is byte-identical to what
 * `feature.id()` returned. A BAM or CRAM read's id IS its record id, so the
 * keys are numeric exactly when `recordIdsAreIds` confirms that on a real
 * `id()`; an adapter whose features carry no `recordId` (SAM, and the
 * PAF/synteny blocks LGVSyntenyDisplay pushes through this pipeline) ships the
 * id strings.
 *
 * `Float64Array`, not `Uint32Array`: a BAM virtual offset is
 * `(blockStart << 16) | inBlock`, which passes 2^32 on any file over ~64GB and
 * is exact in a double to 2^53.
 */

// A read's identity within one display. Numeric for BAM/CRAM (the record id
// `feature.id()` spells), the whole id string otherwise.
export type ReadKey = number | string

export type ReadKeys = Float64Array | string[]

export interface ReadIdentity {
  readKeys: ReadKeys
}

/**
 * The read's full `feature.id()` string — what MST state, the details fetch and
 * the tooltip name a read by. Undefined for an out-of-range index.
 */
export function readIdAt(d: ReadIdentity, i: number): string | undefined {
  const key = d.readKeys[i]
  return key === undefined ? undefined : `${key}`
}

/**
 * A feature's identity key: its record id when it has one (BAM's
 * `fileOffset`, cram-js's record `uniqueId`), else the id string itself.
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
 * Whether these features' record ids spell their ids, which is what lets
 * `readKeys` be numeric. Checked against a real `id()` rather than assumed, so
 * a feature class that builds its id some other way ships strings instead of
 * keys that spell the wrong id. One `id()` per fetch, against one per read.
 */
export function recordIdsAreIds(
  features: { id: () => string; recordId?: number }[],
) {
  const f = features[0]
  return (
    f !== undefined && f.recordId !== undefined && f.id() === `${f.recordId}`
  )
}

/**
 * @deprecated a read id no longer carries an adapter prefix; use
 * `recordIdsAreIds`. Answers `''` where it answered the prefix.
 */
export function readIdPrefixOf(
  features: { id: () => string; recordId?: number }[],
) {
  return recordIdsAreIds(features) ? '' : undefined
}
