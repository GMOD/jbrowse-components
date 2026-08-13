import { BamRecord, forEachMismatchNumeric } from '@gmod/bam'
import { clipLengthAtStartOfReadNumeric } from '@jbrowse/cigar-utils'

import { collectMismatches } from '../shared/collectMismatches.ts'
import { convertTagsToPlainArrays } from '../shared/util.ts'

import type { MismatchFeature } from '../shared/extractCigarFeatures.ts'
import type BamAdapter from './BamAdapter.ts'
import type { PackedReference } from '@gmod/bam'
import type { MismatchCallback, MismatchWindow } from '@jbrowse/cigar-utils'
import type { Feature, SimpleFeatureSerialized } from '@jbrowse/core/util'

/**
 * EXTENDS BamRecord because the adapters pass this class to `@gmod/bam` as
 * `recordClass`, so the library constructs it directly and a read is ONE object
 * rather than a record plus a wrapper around it.
 *
 * **ADR-049 is where this was decided** — it measured `recordClass` at 33
 * bytes/read RETAINED (27.2 MB vs 33.5 MB over 200k records) with the heap
 * profiler, and its finding is the one to carry: the win is that the wrapper
 * moved from retained to TRANSIENT, and retained is the kind that costs. Read it
 * before reopening any of this.
 *
 * That inheritance is not free — a purely additive @gmod/bam release can shadow
 * one of our members without semver saying anything, which 8.6.0 did with
 * `forEachMismatch`, and which `bamRecordOverrides.test.ts` now guards. So what
 * it buys is worth stating precisely. `benches/recordShape.bench.ts` is the
 * reproducible form of ADR-049's memory number and adds the read-path half it
 * did not have; its ~40 bytes/read corroborates the ADR's 33 by a different
 * method. Four samples over 184k pacbio reads:
 *
 *   inject (this)   1.00x   baseline
 *   wrap            1.01-1.08x   (median ~1.05)
 *   control         0.98-1.02x   <- noise floor, so the harness resolves ~±2%
 *
 *   wrapper allocation   2.8 ms per 184k reads   (~15 ns/read)
 *   retained heap        7.3 MB per 184k reads   (~40 bytes/read)
 *
 * So: a few percent on the property-read path, plus ~7 MB on a deep pileup. Both
 * are upper bounds — the bench's consumer is 8 property reads, while the real
 * `extractFeatureArrays` also walks mismatches and parses tags per read, all
 * identical work either way.
 *
 * Worth keeping, and worth keeping in proportion: it is a few percent and some
 * heap, not a design the render path depends on. If a future @gmod/bam release
 * ever collides badly enough to make the inheritance painful, moving to a
 * wrapper is a bounded, known cost rather than a cliff — which is the same
 * conclusion ADR-049 reached from the memory side.
 */
export default class BamSlightlyLazyFeature
  extends BamRecord
  implements MismatchFeature
{
  public adapter!: BamAdapter

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
   * `@gmod/bam` states the hazard from its own side — "this hands the SAME
   * record objects to every query that hits the key, which is what makes
   * callers' per-query writes onto a record leak across queries" (its ADR 0006)
   * — so this class deliberately carries NO `ref`/`refOffset` fields to write.
   * The binding lives only on the view below, where it is `readonly`, which is
   * what makes the rule structural rather than a comment to obey.
   */
  withRegionRef(ref: PackedReference): MismatchFeature {
    return new RegionBoundBamFeature(this, ref)
  }

  id() {
    return `${this.adapter.id}-${this.fileOffset}`
  }

  /**
   * The number `id()` is built from, for callers that only need to tell two
   * records of one fetch apart and would otherwise pay for the string.
   * `fileOffset` is unique per record within a file, so within a single
   * `getFeatures` — which is always one adapter — it carries the whole of the
   * identity and the `${adapter.id}-` prefix distinguishes nothing.
   *
   * Not a replacement for `id()`, which is the cross-adapter identity every
   * other consumer wants. See `dedupeById` in the alignments render RPC, which
   * is the reason this exists.
   */
  get recordId() {
    return this.fileOffset
  }

  /**
   * The QNAME's length in bytes, and a copy of those bytes into a caller's
   * buffer. A PAIR: `buildReadNameBlock` sizes one buffer from the lengths and
   * then has each read write itself into it, so a deep pileup skips 153,677
   * per-read `String.fromCharCode` builds for an array almost nothing reads —
   * one `TextDecoder` call does the lot (benches/readNames.bench.ts).
   *
   * WHY NOT A `nameBytes` VIEW, which is the obvious shape. It was, and it gave
   * back the entire win: a `subarray` per read is an allocation per read, and
   * the block built that way measured 35.9ms against 21.1ms through this pair —
   * i.e. no better than just decoding every name, which is what it was meant to
   * avoid. Keep this allocation-free.
   *
   * The layout knowledge is `@gmod/bam`'s and this reads it back off three
   * public getters, which is a seam that belongs on the record —
   * `agent-docs/reference/BAM_STACK_INTEGRATION.md` files it. `read_name_length`
   * counts the NUL terminator; the name does not.
   */
  get nameLength() {
    return this.read_name_length - 1
  }

  copyNameInto(dest: Uint8Array, at: number) {
    const ba = this.byteArray
    const start = this.b0
    const len = this.read_name_length - 1
    for (let j = 0; j < len; j++) {
      dest[at + j] = ba[start + j]!
    }
  }

  // performance profiling showed that using forEachMismatch rather than
  // computing mismatches array up front was faster, so this is no longer the
  // primary way mismatches are used
  get mismatches() {
    return collectMismatches(this)
  }

  // The UNBOUND walk: no reference, so it resolves mismatches from MD alone.
  // That is the only shape this class is ever asked for — `BamAdapter` emits the
  // raw record only for reads carrying MD (or when no reference could be
  // fetched), and hands every other read to `withRegionRef`, whose
  // RegionBoundBamFeature owns the reference-resolving twin of this method. So
  // there is deliberately no `ref` field here to bind: a record that needs one
  // is never this object.
  //
  // `opts.start`/`opts.end` are genomic reference coords of the viewport; the
  // walk skips CIGAR ops outside them so a chromosome-spanning contig only
  // processes its visible slice. `origin` is what makes the positions come out
  // read-relative, which is the convention every emitter downstream works in.
  //
  // This OVERRIDES `BamRecord.forEachMismatch`, so the options object is not a
  // choice: an override whose signature disagrees with the base is a type
  // error. It calls the walk directly rather than `super` because the base
  // would need an options object built per read, and this path allocates
  // nothing per read.
  override forEachMismatch(callback: MismatchCallback, opts?: MismatchWindow) {
    forEachMismatchNumeric(
      this.NUMERIC_CIGAR,
      this.NUMERIC_SEQ,
      this.seq_length,
      this.NUMERIC_MD,
      this.qual,
      undefined,
      this.start,
      opts?.start ?? Number.NEGATIVE_INFINITY,
      opts?.end ?? Number.POSITIVE_INFINITY,
      this.start,
      callback,
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

  // OVERRIDES BamRecord.toJSON, which emits BAM's own field names rather than a
  // SimpleFeatureSerialized. Marked because it is an override, not because the
  // compiler asks: `noImplicitOverride` is off repo-wide, so this collision was
  // invisible until bamRecordOverrides.test.ts went looking for it.
  override toJSON(): SimpleFeatureSerialized {
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
    // carries its own `start`, which is what locates the read in it
    public readonly ref: PackedReference,
  ) {}

  id() {
    return this.base.id()
  }

  get recordId() {
    return this.base.recordId
  }

  get nameLength() {
    return this.base.nameLength
  }

  copyNameInto(dest: Uint8Array, at: number) {
    this.base.copyNameInto(dest, at)
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

  // Same duck-typing, same silence if it goes missing: modifications-utils'
  // getTagAlt() falls back to two getTag calls, i.e. two full walks of the tag
  // block, whenever a feature lacks this.
  getTagAlt(tagName: string, altName: string) {
    return this.base.getTagAlt(tagName, altName)
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
  //
  // The window is only the viewport: the walk bounds base COMPARISON by what
  // the region covers on its own, so a read overhanging the fetched span still
  // reports the indels and clips outside it.
  forEachMismatch(callback: MismatchCallback, opts?: MismatchWindow) {
    const { ref, base } = this
    forEachMismatchNumeric(
      base.NUMERIC_CIGAR,
      base.NUMERIC_SEQ,
      base.seq_length,
      base.NUMERIC_MD,
      base.qual,
      ref,
      base.start,
      opts?.start ?? Number.NEGATIVE_INFINITY,
      opts?.end ?? Number.POSITIVE_INFINITY,
      base.start,
      callback,
    )
  }
}
