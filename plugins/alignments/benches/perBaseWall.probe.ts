// What the per-base wall costs the worker, and what the sub-pixel bin takes off
// it. The handoff `per-base-subpixel-bin.md` says the motivating number is
// arithmetic rather than a measurement; this is the measurement.
//
//   node --expose-gc plugins/alignments/benches/perBaseWall.probe.ts --depth=1
//
// Drives `extractPerBaseQuality` — the shipped wall — over the pacbio HG002
// fixture's real CIGARs at each zoom tier's `subPixelBinBp`. Not a comparative
// bench: no arms, no control. It answers "how many entries and how much heap",
// which is a counting question, not a ratio question, so none of
// BENCHMARKING.md's interleave/min/control rules apply.
//
// It calls the extract directly rather than through `extractFeatureArrays`,
// over a two-field shim on a plain `BamRecord` rather than through
// `BamSlightlyLazyFeature` — node's type stripping refuses that file's
// parameter properties. The wall is the `out.push` inside the CIGAR walk and
// nothing on either of those paths touches it, so the count is exact and the
// heap is the wall's own.
//
// WHAT IT SAYS: agent-docs/measurements/per-base-wall-bin.json. At the ~1024
// bp/px this fixture's own span is viewed at, the bin takes 30.5M entries and
// 2.0 GB down to 59.6k and 6.7 MB. --depth=8, the ~260x a deep short-read
// pileup reaches, does not finish at all: it OOMs before it packs a byte.

import { join } from 'node:path'

import { BamFile } from '@gmod/bam'

import type { BamRecord } from '@gmod/bam'

const REPO = new URL('../../..', import.meta.url).pathname
const REFNAME = '9'

const { extractPerBaseQuality } = await import(
  join(REPO, 'plugins/alignments/src/features/perBaseQuality/extract.ts')
)
const { subPixelBinBp } = await import(
  join(REPO, 'packages/display-kit/src/subPixelBinBp.ts')
)

const arg = (n: string, d: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d,
  )

const bam = new BamFile({
  bamPath: join(REPO, 'plugins/alignments/benches/pacbio_hg002.bam'),
  baiPath: join(REPO, 'plugins/alignments/benches/pacbio_hg002.bam.bai'),
})
await bam.getHeader()
const base = await bam.getRecordsForRange(REFNAME, 0, 300_000_000)

// The three fields the extract reads, off a plain BamRecord.
const shim = (r: BamRecord) => ({
  get(k: string) {
    return k === 'NUMERIC_QUAL'
      ? r.qual
      : k === 'NUMERIC_CIGAR'
        ? r.NUMERIC_CIGAR
        : k === 'start'
          ? r.start
          : undefined
  },
})

const lo = Math.min(...base.map(r => r.start))
const hi = Math.max(...base.map(r => r.end))
const depth = arg('depth', 1)
const features: ReturnType<typeof shim>[] = []
for (let i = 0; i < depth; i++) {
  features.push(...base.map(shim))
}
console.log(
  `fixture=pacbio_hg002.bam ${REFNAME}:${lo}-${hi} (${((hi - lo) / 1000).toFixed(0)}kb)\n` +
    `  ${base.length} reads x${depth} = ${features.length} in the pileup`,
)

const region = { refName: REFNAME, start: lo, end: hi, assemblyName: 'hg002' }

function run(binBp: number) {
  globalThis.gc?.()
  globalThis.gc?.()
  const before = process.memoryUsage().heapUsed
  const out: unknown[] = []
  const t = performance.now()
  try {
    for (const [i, f] of features.entries()) {
      extractPerBaseQuality(f, i, region, binBp, out)
    }
  } catch (e) {
    return { n: out.length, ms: performance.now() - t, peak: 0, err: e }
  }
  const ms = performance.now() - t
  const peak = process.memoryUsage().heapUsed - before
  return { n: out.length, ms, peak, err: undefined }
}

console.log('\n  bpPerPx   binBp       entries       ms     heapMB')
for (const bpPerPx of [2, 4, 8, 32, 128, 512, 1024]) {
  const binBp = subPixelBinBp(bpPerPx)
  const { n, ms, peak, err } = run(binBp)
  console.log(
    `  ${String(bpPerPx).padStart(7)} ${String(binBp).padStart(7)}  ` +
      `${n.toLocaleString().padStart(12)} ${ms.toFixed(0).padStart(8)} ${err}`
      ? `  THREW ${String(err).split('\n')[0]} after ${n.toLocaleString()} entries`
      : (peak / 1e6).toFixed(1).padStart(10),
  )
}
console.log(
  `\n  a 1000px canvas over this span is ~${((hi - lo) / 1000).toFixed(0)} bp/px`,
)
