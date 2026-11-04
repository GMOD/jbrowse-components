// The gate for a drawn-read filter leaving coverage whole: every read of the
// sample runs through the extract, the detail arrays and the coverage pipeline,
// then the drawn ones are compacted out, so a filter that draws few reads must
// cost about what the unfiltered render does (within 1.1x). Records are read
// once; each round renders them afresh under every arm, interleaved; min over
// rounds.
//
//   node plugins/alignments/benches/drawnReadFilter.bench.ts
//   node plugins/alignments/benches/drawnReadFilter.bench.ts --only=1000x.longread.bam --rounds=15
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

import { BamFile } from '@gmod/bam'
import createJexlInstance from '@jbrowse/core/util/jexl'

import BamSlightlyLazyFeature from '../src/BamAdapter/BamSlightlyLazyFeature.ts'
import { groupsOfFetch } from '../src/RenderAlignmentDataRPC/executeRenderAlignmentData.ts'
import { filterChainFeatures } from '../src/RenderAlignmentDataRPC/filterChainFeatures.ts'

import type { WorkerFacet } from '../src/shared/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'

const DATA = join(process.env.HOME!, 'src/jb2bench/data')

function arg(name: string, dflt: string) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}

const only = arg('only', '1000x.shortread.bam')
const REFNAME = arg('refName', 'chr22_mask')
const START = Number(arg('start', '124000'))
const END = Number(arg('end', '134000'))
const ROUNDS = Number(arg('rounds', '9'))

const path = join(DATA, only)
const bam = new BamFile({
  bamPath: path,
  baiPath: `${path}.bai`,
  recordClass: BamSlightlyLazyFeature,
})
await bam.getHeader()
const names = (
  bam as unknown as { indexToChr: { refName: string }[] }
).indexToChr.map(c => c.refName)
const records = await bam.getRecordsForRange(REFNAME, START, END)
// what the adapter stamps on each record it hands out
const adapter = {
  id: 'bench',
  refIdToName: (id: number) => names[id],
} as unknown as BamSlightlyLazyFeature['adapter']
for (const r of records) {
  r.adapter = adapter
}
const firstName = records[Math.floor(records.length / 2)]!.get('name')

const SV_EVIDENCE: FieldPredicate[] = [{ field: 'svSignal', equal: true }]
const SV_CHANNEL: WorkerFacet = { field: 'svChannel' }

// The SV channels preset is the last two: the facet, then the facet under
// its filter
const arms: Record<string, { filter: FieldPredicate[]; facet?: WorkerFacet }> =
  {
    unfiltered: { filter: [] },
    'this read': { filter: [{ field: 'name', equal: firstName }] },
    'SV evidence': { filter: SV_EVIDENCE },
    'not split': { filter: [{ field: 'split', equal: false }] },
    'SV channel facet': { filter: [], facet: SV_CHANNEL },
    'SV channels': { filter: SV_EVIDENCE, facet: SV_CHANNEL },
  }

// the render reads only `jexl` off it while no sequence adapter is passed
const pluginManager = { jexl: createJexlInstance() } as unknown as PluginManager
const region = {
  assemblyName: 'bench',
  refName: REFNAME,
  start: START,
  end: END,
}

async function render({
  filter,
  facet,
}: {
  filter: FieldPredicate[]
  facet?: WorkerFacet
}) {
  const t0 = performance.now()
  await groupsOfFetch({
    pluginManager,
    args: {
      sessionId: 'bench',
      adapterConfig: { type: 'BamAdapter' },
      regions: [region],
      statusCallback: undefined,
      showCoverage: true,
      filter,
      facet,
    },
    featuresArray: records,
  })
  return performance.now() - t0
}

const best: Record<string, number> = {}
for (let r = 0; r < ROUNDS; r++) {
  for (const [name, arm] of Object.entries(arms)) {
    best[name] = Math.min(best[name] ?? Infinity, await render(arm))
  }
}
console.log(
  `${only} ${REFNAME}:${START}-${END}  ${records.length} records, min of ${ROUNDS}`,
)
for (const [name, { filter }] of Object.entries(arms)) {
  const drawn = filterChainFeatures(records, filter).length
  console.log(
    `${name.padEnd(12)} ${best[name]!.toFixed(1).padStart(8)} ms  ${(best[name]! / best.unfiltered!).toFixed(2)}x  ${drawn} drawn`,
  )
}
