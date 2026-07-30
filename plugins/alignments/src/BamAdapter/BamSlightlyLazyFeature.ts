import { BamRecord } from '@gmod/bam'
import {
  clipLengthAtStartOfReadNumeric,
  forEachMismatchNumeric,
} from '@jbrowse/cigar-utils'

import { collectMismatches } from '../shared/collectMismatches.ts'
import { convertTagsToPlainArrays } from '../shared/util.ts'

import type { MismatchFeature } from '../shared/extractCigarFeatures.ts'
import type BamAdapter from './BamAdapter.ts'
import type { MismatchCallback } from '@jbrowse/cigar-utils'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'

export default class BamSlightlyLazyFeature
  extends BamRecord
  implements MismatchFeature
{
  public adapter!: BamAdapter
  // shared region-wide reference string (covers many reads); refOffset locates
  // this read's start within it, so no per-read substring is allocated.
  // Bind these with `withRegionRef`, never by assignment — see below.
  public ref?: string
  public refOffset = 0

  /**
   * A per-fetch view of this record bound to one region's reference slice.
   *
   * Must be a view rather than a write, because these records are NOT per-fetch:
   * `@gmod/bam` memoizes decoded records in a per-file chunk LRU keyed on the
   * chunk's block positions, so any two queries resolving to the same chunk span
   * — the same range refetched, or two displayed regions covered by one chunk —
   * get back the identical objects. A display fetches all its needed regions at
   * once, so assigning here let the last fetch to resolve rebind the read for
   * every other region still holding it, resolving one region's mismatches
   * against another's sequence. (It usually got away with it: different query
   * ranges normally produce different chunk keys, so the cache misses and each
   * fetch decodes its own copy. That is an accident of the key, not a guarantee.)
   *
   * `Object.create` rather than a copy: BamRecord memoizes on `this`
   * (`_cachedTags`, `_cachedNumericCigar`, …), and a prototype-delegating view
   * reads whatever the shared record has already computed instead of re-decoding
   * it. Only `ref`/`refOffset` become own properties, shadowing the base. The
   * feature id is inherited, so it stays region-independent as the pileup's read
   * lookups require.
   */
  withRegionRef(ref: string, refOffset: number): BamSlightlyLazyFeature {
    const view: BamSlightlyLazyFeature = Object.create(this)
    view.ref = ref
    view.refOffset = refOffset
    return view
  }

  id() {
    return `${this.adapter.id}-${this.fileOffset}`
  }

  // performance profiling showed that using forEachMismatch rather than
  // computing mismatches array up front was faster, so this is no longer the
  // primary way mismatches are used
  get mismatches() {
    return collectMismatches(this)
  }

  // windowStart/windowEnd are genomic reference coords of the viewport; the
  // walk skips CIGAR ops outside them so a chromosome-spanning contig only
  // processes its visible slice. Converted to read-relative roffset here.
  //
  // With no window, the walk still can't run past what `ref` covers: the shared
  // region string spans only [-refOffset, ref.length - refOffset) in this read's
  // reference-relative space, and a read overhanging the fetched region has no
  // reference bases for its overhang — comparing against an out-of-range
  // charCodeAt (NaN) would report every one of those bases as a mismatch. Reads
  // carrying MD need no reference and walk in full.
  forEachMismatch(
    callback: MismatchCallback,
    windowStart?: number,
    windowEnd?: number,
  ) {
    const { ref, refOffset, start } = this
    const refLo = ref === undefined ? undefined : -refOffset
    const refHi = ref === undefined ? undefined : ref.length - refOffset
    forEachMismatchNumeric(
      this.NUMERIC_CIGAR,
      this.NUMERIC_SEQ,
      this.seq_length,
      this.NUMERIC_MD,
      this.qual,
      ref,
      callback,
      refOffset,
      windowStart === undefined ? refLo : windowStart - start,
      windowEnd === undefined ? refHi : windowEnd - start,
    )
  }

  get qualString() {
    return this.qual?.join(' ')
  }

  get clipLengthAtStartOfRead() {
    return clipLengthAtStartOfReadNumeric(this.NUMERIC_CIGAR, this.strand)
  }

  get refName() {
    return this.adapter.refIdToName(this.ref_id)!
  }
  get(name: 'refName'): string
  get(name: 'name' | 'type' | 'id' | 'source'): string | undefined
  get(name: 'start' | 'end'): number
  get(name: 'phase'): 0 | 1 | 2 | undefined
  get(name: 'strand'): -1 | 0 | 1 | undefined
  get(name: 'score'): number | undefined
  get(name: 'subfeatures'): Feature[] | undefined
  get(field: string): unknown
  get(field: string): unknown {
    switch (field) {
      case 'mismatches':
        return this.mismatches
      case 'name':
        return this.name
      case 'start':
        return this.start
      case 'refName':
        return this.refName
      case 'end':
        return this.end
      case 'strand':
        return this.strand
      case 'qual':
        return this.qualString
      case 'seq':
        return this.seq
      case 'tags':
        return this.tags
      case 'NUMERIC_SEQ':
        return this.NUMERIC_SEQ
      case 'NUMERIC_CIGAR':
        return this.NUMERIC_CIGAR
      case 'CIGAR':
        return this.CIGAR
      case 'NUMERIC_QUAL':
        return this.qual
      case 'NUMERIC_MD':
        return this.NUMERIC_MD
      case 'seq_length':
        return this.seq_length
      case 'flags':
        return this.flags
      case 'pair_orientation':
        return this.pair_orientation
      case 'next_ref':
        return this.next_ref
      case 'next_pos':
        return this.next_pos
      case 'template_length':
        return this.template_length
      case 'clipLengthAtStartOfRead':
        return this.clipLengthAtStartOfRead
      case 'score':
        return this.score

      default:
        return this.fields[field]
    }
  }

  parent() {
    return undefined
  }

  children() {
    return undefined
  }

  // Only reached by toJSON() and the `default` branch of get() for fields with
  // no case above — never on the render path (measured: 0 accesses per read over
  // a pacbio pileup), so it is deliberately not memoized.
  get fields(): SimpleFeatureSerialized {
    return {
      start: this.start,
      name: this.name,
      end: this.end,
      score: this.score,
      strand: this.strand,
      template_length: this.template_length,
      flags: this.flags,
      tags: this.tags,
      refName: this.refName,
      type: 'match',
      pair_orientation: this.pair_orientation,
      next_ref: this.next_ref,
      next_pos: this.next_pos,
      next_segment_position: this.next_segment_position,
      uniqueId: this.id(),
    }
  }

  get next_ref() {
    return this.isPaired()
      ? this.adapter.refIdToName(this.next_refid)
      : undefined
  }

  get next_segment_position() {
    return this.isPaired()
      ? `${this.adapter.refIdToName(this.next_refid)}:${this.next_pos + 1}`
      : undefined
  }

  toJSON(): SimpleFeatureSerialized {
    return {
      ...this.fields,
      CIGAR: this.CIGAR,
      seq: this.seq,
      tags: convertTagsToPlainArrays(this.tags),
      qual: this.qualString,
    }
  }
}
