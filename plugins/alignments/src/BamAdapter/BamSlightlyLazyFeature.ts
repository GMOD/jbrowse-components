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
   */
  withRegionRef(ref: string, refOffset: number): MismatchFeature {
    return new RegionBoundBamFeature(this, ref, refOffset)
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

/**
 * One read bound to a single fetch's reference slice — what `withRegionRef`
 * returns, and the only thing `BamAdapter` emits for a read lacking MD.
 *
 * A delegating wrapper rather than a copy or an `Object.create` view, purely for
 * speed. The shared record must not be mutated (see `withRegionRef`), so the
 * binding needs its own object; of the ways to make one, only a plain class
 * keeps a single hidden class across every read. Benchmarked at 300k reads
 * (build + the property reads the extract pass makes), relative to just mutating
 * the shared record — which is what the correctness bug bought:
 *
 *                          build    read    heap
 *   mutate (incorrect)        1x      1x    +30MB
 *   this wrapper              1x    ~4.5x   +41MB
 *   Object.assign clone     ~10x     ~6x    +73MB
 *   Object.create(record)  ~100x   ~200x   +550MB
 *
 * `Object.create(record)` gives every view its own hidden class (its prototype
 * is a different object each time), so every property site that sees them goes
 * megamorphic and each read retains a prototype chain. Don't reintroduce it.
 *
 * The `~4.5x` column is property reads ALONE and does not survive contact with
 * the real consumer. Re-measured through `extractFeatureArrays` against the same
 * binding written onto the record (the incorrect zero-allocation path), over
 * BAMs spanning MD/no-MD and 148bp/550bp/25kb/537kb reads, arms interleaved rep
 * by rep and min-of-15: **every case lands within a few percent of parity**.
 * Whatever the wrapper costs is lost under the CIGAR walk and the typed-array
 * fills, and only MD-less reads allocate one at all.
 *
 * So do NOT "optimize" this away. The zero-allocation form — threading the
 * fetch's `(ref, refStart)` pair into `forEachMismatch` instead of binding it
 * per read — would reach `buildConsensusTally` in alignments-core, and it is
 * now measured to buy nothing.
 *
 * Two traps if you re-measure. Unwrapping the features to get a baseline leaves
 * `ref` undefined, and `forEachMismatchNumeric` then skips mismatch detection
 * entirely — that comparison reports 10x and is meaningless. And running the
 * arms as two blocks lets whichever goes second inherit the other's warmup,
 * which alone flipped one case from 1.375x to 0.954x.
 *
 * Three delegation traps, all load-bearing:
 *   - `getTag` is duck-typed by `@jbrowse/modifications-utils`' `getTag()`, not
 *     declared on `Feature`, so nothing would catch its absence — and the
 *     fallback decodes EVERY tag on the read to answer one.
 *   - `get('mismatches')` must resolve against THIS binding, so it can't be
 *     forwarded to the unbound base like every other field.
 *   - `fields`/`toJSON` are only reached off the render path, so they forward.
 */
class RegionBoundBamFeature implements MismatchFeature {
  constructor(
    private base: BamSlightlyLazyFeature,
    public readonly ref: string,
    public readonly refOffset: number,
  ) {}

  id() {
    return this.base.id()
  }

  get start() {
    return this.base.start
  }

  get clipLengthAtStartOfRead() {
    return this.base.clipLengthAtStartOfRead
  }

  get NUMERIC_CIGAR() {
    return this.base.NUMERIC_CIGAR
  }

  // the bound twin of BamSlightlyLazyFeature.mismatches
  get mismatches() {
    return collectMismatches(this)
  }

  // Duck-typed by modifications-utils' getTag(); without it that helper falls
  // back to `get('tags')`, which decodes every tag on the read to answer one.
  getTag(tagName: string) {
    return this.base.getTag(tagName)
  }

  // 'mismatches' is the one field that depends on the binding — everything else
  // is a property of the record and forwards.
  get(name: 'refName'): string
  get(name: 'name' | 'type' | 'id' | 'source'): string | undefined
  get(name: 'start' | 'end'): number
  get(name: 'phase'): 0 | 1 | 2 | undefined
  get(name: 'strand'): -1 | 0 | 1 | undefined
  get(name: 'score'): number | undefined
  get(name: 'subfeatures'): Feature[] | undefined
  get(field: string): unknown
  get(field: string): unknown {
    return field === 'mismatches' ? this.mismatches : this.base.get(field)
  }

  parent() {
    return undefined
  }

  children() {
    return undefined
  }

  toJSON(): SimpleFeatureSerialized {
    return this.base.toJSON()
  }

  // The reference-resolving walk — the whole reason this object exists. Mirrors
  // BamSlightlyLazyFeature.forEachMismatch, reading the packed arrays off the
  // shared record but the reference off this binding.
  forEachMismatch(
    callback: MismatchCallback,
    windowStart?: number,
    windowEnd?: number,
  ) {
    const { ref, refOffset, base } = this
    const start = base.start
    forEachMismatchNumeric(
      base.NUMERIC_CIGAR,
      base.NUMERIC_SEQ,
      base.seq_length,
      base.NUMERIC_MD,
      base.qual,
      ref,
      callback,
      refOffset,
      windowStart === undefined ? -refOffset : windowStart - start,
      windowEnd === undefined ? ref.length - refOffset : windowEnd - start,
    )
  }
}
