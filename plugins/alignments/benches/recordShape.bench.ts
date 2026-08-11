// Does injecting our own class into @gmod/bam (`recordClass`) actually beat
// wrapping its records? That choice is why BamSlightlyLazyFeature EXTENDS
// BamRecord, and the inheritance is not free: a purely additive @gmod/bam
// release can shadow one of our members without semver saying anything
// (bamRecordOverrides.test.ts guards it). So the speed had better be real.
//
//   node --expose-gc plugins/alignments/benches/recordShape.bench.ts
//
// Flags: --rounds=<n> (default 12), --repeat=<n> (default 4)
//
// The general harness rules below — interleave, min-of-rounds, run a control —
// and the traps they exist for are written up once in
// `agent-docs/reference/BENCHMARKING.md`. Read that before writing a new bench.
//
// THREE SIDES, one of which is a control:
//   inject   — recordClass: our subclass. One object per read. What we ship.
//   wrap     — plain BamRecord + a delegating feature. Two objects per read.
//   control  — a second, byte-identical injected class. Whatever it scores
//              against `inject` is this harness's own noise, and the gap
//              between the two real sides has to clear it to mean anything.
//
// INTERLEAVING AND MIN. Sides run round-robin in one process and the reported
// number is the MIN across rounds, not the mean. The lesson is inherited from
// the mismatch-walk bench this replaces (deleted in ec75079bf1): timing sides
// in blocks or in separate processes measures whatever else the machine was
// doing, and the same comparison read 10.4x, 1.74x and ~1.1x across three
// harness designs before interleaving settled it at parity.
//
// ---------------------------------------------------------------------------
// WHAT IT SAYS. Four samples at 183,680 reads (the pacbio HG002 fixture — 2296
// real long reads — repeated to the size a deep pileup actually reaches):
//
//     sample        wrap      control
//     1             1.065x    0.982x
//     2             1.031x    0.977x
//     3 (--flip)    1.014x    1.021x
//     4             1.084x    0.992x
//
// Read the control column first: 0.98-1.02x, centred on 1.00, so the harness
// resolves to about ±2%. Against that floor the wrapper sits consistently
// above, by roughly 3-6%.
//
// So injection IS a speed win on the property-read path, but a small one — and
// that 3-6% is an UPPER BOUND on what production sees, because this consumer is
// 8 property reads and nothing else. Real `extractFeatureArrays` also runs the
// mismatch walk, tag extraction and modification parsing per read, all identical
// work on both sides, which dilutes the share this difference can affect. It
// agrees with what RegionBoundBamFeature's comment found re-measuring the same
// question through the real consumer: "within a few percent of parity".
//
// The other half, real and repeatable:
//
//   wrapper allocation   2.8 ms per 184k reads   (~15 ns/read)
//   retained heap        7.3 MB per 184k reads   (~40 bytes/read)
//
// DON'T TRUST A PARITY READING FROM A WEAKER HARNESS. An earlier version of
// this file, using `new Function` consumers, reported 1.007x against a 1.005x
// control and looked like clean parity. It wasn't — the control was absorbing
// the effect (see the consumer comment below). The control column is the thing
// to check before believing any row.
//
// Operational consequence: `extends BamRecord` costs a real hazard — a purely
// additive @gmod/bam release can shadow one of our members, which 8.6.0 did and
// bamRecordOverrides.test.ts now guards. A few percent plus ~7 MB is a fair
// price for it, so keep the design; but it is not so large that the hazard is
// unavoidable. If a release ever collides badly, moving to a wrapper is a known,
// bounded cost rather than a cliff.
// ---------------------------------------------------------------------------
import { BamFile, BamRecord } from '@gmod/bam'

const root = new URL('../../..', import.meta.url).pathname
const arg = (name: string, dflt: number) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? Number(hit.split('=')[1]) : dflt
}
const ROUNDS = arg('rounds', 12)
const REPEAT = arg('repeat', 4)

// ---------------------------------------------------------------------------
// The two designs. Both expose exactly the surface extractFeatureArrays reads
// per read, and nothing else — this is a shape experiment, not a port.

// INJECT: @gmod/bam constructs this directly, so a read is ONE object.
//
// Built through a factory rather than written twice, so the control below is
// the same source by construction and cannot drift from it. Each call still
// produces a distinct constructor with its own prototype — and therefore its
// own hidden class and its own inline caches — which is exactly what a real
// second implementation would have.
const makeFeatureClass = () =>
  class extends BamRecord {
    id() {
      return `bench-${this.fileOffset}`
    }
    get refName() {
      return 'ctgA'
    }
    get clipLengthAtStartOfRead() {
      return 0
    }
    get next_ref(): string | undefined {
      return this.isPaired() ? 'ctgA' : undefined
    }
    get(field: string): unknown {
      switch (field) {
        case 'start':
          return this.start
        case 'end':
          return this.end
        case 'strand':
          return this.strand
        case 'refName':
          return this.refName
        case 'next_pos':
          return this.next_pos
        case 'next_ref':
          return this.next_ref
        case 'flags':
          return this.flags
        case 'CIGAR':
          return this.CIGAR
        default:
          return undefined
      }
    }
  }

const InjectedFeature = makeFeatureClass()
const ControlFeature = makeFeatureClass()

// WRAP: @gmod/bam constructs a BamRecord, we allocate a delegating feature over
// it. Two objects per read. Modelled on RegionBoundBamFeature, which is the
// wrapper this codebase actually ships for the MD-less path.
class WrappedFeature {
  // a plain field, not a `private base:` parameter property — node's
  // type-stripping rejects those and this file runs under bare node
  base: BamRecord
  constructor(base: BamRecord) {
    this.base = base
  }
  id() {
    return `bench-${this.base.fileOffset}`
  }
  get start() {
    return this.base.start
  }
  get end() {
    return this.base.end
  }
  get strand() {
    return this.base.strand
  }
  get flags() {
    return this.base.flags
  }
  get next_pos() {
    return this.base.next_pos
  }
  get CIGAR() {
    return this.base.CIGAR
  }
  get refName() {
    return 'ctgA'
  }
  get clipLengthAtStartOfRead() {
    return 0
  }
  get next_ref(): string | undefined {
    return this.base.isPaired() ? 'ctgA' : undefined
  }
  getTag(t: string) {
    return this.base.getTag(t)
  }
  get(field: string): unknown {
    switch (field) {
      case 'start':
        return this.start
      case 'end':
        return this.end
      case 'strand':
        return this.strand
      case 'refName':
        return this.refName
      case 'next_pos':
        return this.next_pos
      case 'next_ref':
        return this.next_ref
      case 'flags':
        return this.flags
      case 'CIGAR':
        return this.CIGAR
      default:
        return undefined
    }
  }
}

// ---------------------------------------------------------------------------

// The fixture is a slice of HG002, not a whole genome — GRCh37 naming, and only
// one contig carries reads. Found once and reused, rather than hardcoded, so
// re-slicing the fixture doesn't silently benchmark zero reads.
let cachedRef: { refName: string; length: number } | undefined
async function resolveRef(bam: any) {
  if (cachedRef) {
    return cachedRef
  }
  for (const c of bam.indexToChr as { refName: string; length: number }[]) {
    const probe = await bam.getRecordsForRange(c.refName, 0, c.length)
    if (probe.length) {
      cachedRef = c
      return c
    }
  }
  throw new Error('fixture has no reads on any contig')
}

async function fetchWith<T>(recordClass: any): Promise<T[]> {
  const bam = new BamFile({
    bamPath: `${root}/plugins/alignments/benches/pacbio_hg002.bam`,
    baiPath: `${root}/plugins/alignments/benches/pacbio_hg002.bam.bai`,
    recordClass,
  })
  await bam.getHeader()
  const { refName, length } = await resolveRef(bam)
  const recs = await bam.getRecordsForRange(refName, 0, length)
  if (!recs.length) {
    throw new Error(`no reads on ${refName}`)
  }
  const out: T[] = []
  for (let i = 0; i < REPEAT; i++) {
    out.push(...(recs as unknown as T[]))
  }
  return out
}

// What extractFeatureArrays actually touches per read. Deliberately NOT the
// mismatch walk: that is identical work on both sides (same packed arrays, same
// @gmod/bam walk), so including it would dilute the very difference under test.
//
// EACH SIDE GETS ITS OWN COPY, and the copies are written out longhand ON
// PURPOSE. Do not refactor these three into one function, or into one factory
// that returns a closure — the duplication IS the mechanism.
//
// A single shared consumer sees all three feature shapes, goes megamorphic at
// every property site, and charges that cost to everyone: the first version of
// this bench scored the CONTROL — a byte-identical copy of the baseline — at
// 1.14x, which is the harness reporting its own polymorphism as a result.
// Production never does this: `extractFeatureArrays` sees exactly one feature
// shape, whichever the adapter emits, so each side has to be measured
// monomorphic as it will actually run.
//
// Sharing one SOURCE is enough to reintroduce it. Three `new Function` calls
// with identical source text hit V8's compilation cache, come back sharing a
// feedback vector, and the control went straight back to ~1.3x — whichever side
// warmed the shared cache first won permanently, and no amount of interleaving
// or rotation moved it. Three separate function literals is what actually gives
// three separate sets of inline caches.
//
// Each body is identical; keep them that way when you change one.
function consumeA(features: any[]) {
  let sink = 0
  for (const f of features) {
    sink += f.get('start') as number
    sink += f.get('strand') as number
    sink += f.get('next_pos') as number
    sink += f.clipLengthAtStartOfRead
    sink += ((f.get('next_ref') as string | undefined) ?? '').length
    sink += ((f.get('refName') as string | undefined) ?? '').length
    sink += f.get('flags') as number
    sink += f.id().length
  }
  return sink
}

function consumeB(features: any[]) {
  let sink = 0
  for (const f of features) {
    sink += f.get('start') as number
    sink += f.get('strand') as number
    sink += f.get('next_pos') as number
    sink += f.clipLengthAtStartOfRead
    sink += ((f.get('next_ref') as string | undefined) ?? '').length
    sink += ((f.get('refName') as string | undefined) ?? '').length
    sink += f.get('flags') as number
    sink += f.id().length
  }
  return sink
}

function consumeC(features: any[]) {
  let sink = 0
  for (const f of features) {
    sink += f.get('start') as number
    sink += f.get('strand') as number
    sink += f.get('next_pos') as number
    sink += f.clipLengthAtStartOfRead
    sink += ((f.get('next_ref') as string | undefined) ?? '').length
    sink += ((f.get('refName') as string | undefined) ?? '').length
    sink += f.get('flags') as number
    sink += f.id().length
  }
  return sink
}

const time = (fn: () => unknown) => {
  const t0 = performance.now()
  fn()
  return performance.now() - t0
}

const heapOf = (make: () => unknown) => {
  globalThis.gc?.()
  const before = process.memoryUsage().heapUsed
  const held = make()
  globalThis.gc?.()
  const after = process.memoryUsage().heapUsed
  void held
  return (after - before) / 1e6
}

async function main() {
  if (!globalThis.gc) {
    console.error('run with --expose-gc')
  }
  console.log(`loading pacbio reads (repeat=${REPEAT}, rounds=${ROUNDS})…`)

  // Fetch order is itself a variable: the array built first ends up oldest and
  // most compact after GC, which is worth ~1.3x on this loop — larger than
  // anything the shapes differ by. `--flip` fetches the control first. If the
  // advantage follows the fetch order rather than the design, the "difference"
  // between inject and wrap is this artifact and nothing else.
  const flip = process.argv.includes('--flip')
  let injected: any[]
  let controlled: any[]
  if (flip) {
    controlled = await fetchWith<any>(ControlFeature)
    injected = await fetchWith<any>(InjectedFeature)
  } else {
    injected = await fetchWith<any>(InjectedFeature)
    controlled = await fetchWith<any>(ControlFeature)
  }
  const plain = await fetchWith<BamRecord>(undefined)
  const wrapped = plain.map(r => new WrappedFeature(r))
  console.log(`${injected.length} reads per round\n`)

  // Identity: a faster shape that answers differently is not a faster shape.
  for (let i = 0; i < injected.length; i += 997) {
    const a = injected[i]
    const b = wrapped[i]
    if (!a || !b) {
      throw new Error(`missing read at ${i}`)
    }
    if (a.get('start') !== b.get('start') || a.id() !== b.id()) {
      throw new Error(`sides disagree at read ${i}`)
    }
  }

  // ROTATED, not just interleaved. Fixed order is itself a bias: whichever side
  // runs first each round meets a differently-warmed cache than the ones after
  // it. With the order pinned, the CONTROL — again, a byte-identical copy of the
  // baseline — came out at 1.35x while the wrapper came out at 1.33x, i.e. the
  // position effect was larger than the effect under test and had swallowed it.
  // Rotating by round spreads each side across every slot.
  const sides = [
    { name: 'inject' as const, data: injected, run: consumeA },
    { name: 'wrap' as const, data: wrapped, run: consumeB },
    { name: 'control' as const, data: controlled, run: consumeC },
  ]
  const best = { inject: Infinity, wrap: Infinity, control: Infinity }
  for (let round = 0; round < ROUNDS; round++) {
    for (let i = 0; i < sides.length; i++) {
      const side = sides[(round + i) % sides.length]!
      best[side.name] = Math.min(
        best[side.name],
        time(() => side.run(side.data)),
      )
    }
  }

  console.log('CONSUMER READS (min of rounds, lower is better)')
  console.log(`  inject   ${best.inject.toFixed(1)} ms   (1.00x, baseline)`)
  console.log(
    `  wrap     ${best.wrap.toFixed(1)} ms   (${(best.wrap / best.inject).toFixed(3)}x)`,
  )
  console.log(
    `  control  ${best.control.toFixed(1)} ms   (${(best.control / best.inject).toFixed(3)}x)  <- harness noise floor`,
  )

  // The marginal build cost the wrap design adds: inject allocates nothing
  // extra (@gmod/bam already made the object), wrap allocates one per read.
  let bestWrapBuild = Infinity
  for (let round = 0; round < ROUNDS; round++) {
    bestWrapBuild = Math.min(
      bestWrapBuild,
      time(() => plain.map(r => new WrappedFeature(r))),
    )
  }
  console.log('\nWRAPPER ALLOCATION (cost inject does not pay at all)')
  console.log(
    `  wrap     ${bestWrapBuild.toFixed(1)} ms for ${plain.length} reads`,
  )

  const wrapHeap = heapOf(() => plain.map(r => new WrappedFeature(r)))
  console.log('\nRETAINED HEAP')
  console.log(
    `  wrappers over ${plain.length} reads: ${wrapHeap.toFixed(1)} MB (inject: 0)`,
  )
}

await main()
