// How often do one read's modification calls share a pixel column at wide
// zoom, and how often do the calls sharing one disagree in color?
//
//   node --experimental-transform-types --no-warnings plugins/alignments/benches/modPixelCollisions.probe.ts
//
// Flags: --bam=<dir>, --refName, --start, --end
import { join } from 'node:path'

import { BamFile } from '@gmod/bam'

import BamSlightlyLazyFeature from '../src/BamAdapter/BamSlightlyLazyFeature.ts'
import {
  extractMethylation,
  extractModifications,
} from '../src/features/modification/extract.ts'
import { DEFAULT_BASES_FILTER } from '../src/shared/basesFilter.ts'
import { getStrand } from '../src/shared/util.ts'

import type { ModificationLayer } from '../src/shared/types.ts'
import type { ModificationEntry } from '../src/shared/webglRpcTypes.ts'
import type { Region } from '@jbrowse/core/util'

const arg = (name: string, dflt: string) =>
  process.argv
    .find(a => a.startsWith(`--${name}=`))
    ?.slice(`--${name}=`.length) ?? dflt

const BAM = arg('bam', join(process.env.HOME!, 'src/jb2bench/data'))
const region: Region = {
  assemblyName: 'probe',
  refName: arg('refName', 'chr22_mask'),
  start: Number(arg('start', '0')),
  end: Number(arg('end', '400000')),
}

const bam = new BamFile({
  bamPath: join(BAM, '200x.longread.mod.bam'),
  recordClass: BamSlightlyLazyFeature,
})
await bam.getHeader()
const features = await bam.getRecordsForRange(
  region.refName,
  region.start,
  region.end,
)

const views: [string, ModificationLayer][] = [
  [
    'by-type',
    { field: 'modifications', unmodified: false, filter: DEFAULT_BASES_FILTER },
  ],
  [
    'two-color',
    { field: 'modifications', unmodified: true, filter: DEFAULT_BASES_FILTER },
  ],
]

function extract(layer: ModificationLayer) {
  const out: ModificationEntry[] = []
  features.forEach((f, i) => {
    const strand = getStrand(f)
    const modData = extractModifications(
      f,
      i,
      f.get('start'),
      strand,
      region,
      layer,
      new Set(),
      new Map(),
      out,
    )
    if (layer.unmodified && modData) {
      extractMethylation(
        i,
        f.get('start'),
        strand,
        region,
        modData,
        out,
        layer.filter,
      )
    }
  })
  return out
}

console.log(
  `${features.length} reads, ${region.refName}:${region.start}-${region.end}`,
)
console.log(
  'view       bp/px    calls  drawn cols  cols with >1 call  mixed-color cols  calls per col',
)
for (const [name, layer] of views) {
  const marks = extract(layer)
  for (const bpPerPx of [1, 2, 5, 10, 20, 50, 100]) {
    const cols = new Map<number, { n: number; colors: Set<number> }>()
    for (const m of marks) {
      const key = m.readIndex * 1e7 + Math.floor(m.position / bpPerPx)
      let c = cols.get(key)
      if (!c) {
        c = { n: 0, colors: new Set() }
        cols.set(key, c)
      }
      c.n++
      c.colors.add(m.color)
    }
    let shared = 0
    let mixed = 0
    for (const c of cols.values()) {
      if (c.n > 1) {
        shared++
      }
      if (c.colors.size > 1) {
        mixed++
      }
    }
    const pct = (x: number) => `${((100 * x) / cols.size).toFixed(1)}%`
    console.log(
      `${name.padEnd(10)} ${String(bpPerPx).padStart(5)} ${String(marks.length).padStart(8)} ${String(cols.size).padStart(11)} ${pct(shared).padStart(18)} ${pct(mixed).padStart(17)} ${(marks.length / cols.size).toFixed(2).padStart(14)}`,
    )
  }
}
