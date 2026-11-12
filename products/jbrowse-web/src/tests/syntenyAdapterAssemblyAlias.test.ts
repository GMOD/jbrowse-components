import path from 'node:path'

import { isFeatureAdapter } from '@jbrowse/core/data_adapters/BaseAdapter'
import { getAdapter } from '@jbrowse/core/data_adapters/dataAdapterCache'
import { getEnv } from '@jbrowse/core/util'
import { renameRegionsForAdapter } from '@jbrowse/synteny-core'
import { firstValueFrom } from 'rxjs'
import { toArray } from 'rxjs/operators'

import { createTestSession } from '../rootModel/test_util.ts'

import type { Region } from '@jbrowse/core/util'
import type { ComparativeOptions } from '@jbrowse/synteny-core'

jest.mock('../makeWorkerInstance', () => () => {})

const SESSION_ID = 'synteny-adapter-assembly-alias'

const local = (file: string) => ({
  localPath: path.resolve(file),
  locationType: 'LocalPathLocation' as const,
})

function assembly(
  name: string,
  contigs: [refName: string, length: number][],
  aliases: string[] = [],
) {
  return {
    name,
    aliases,
    sequence: {
      type: 'ReferenceSequenceTrack',
      trackId: `${name}_refseq`,
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: contigs.map(([refName, end]) => ({
          refName,
          uniqueId: `${name}_${refName}`,
          start: 0,
          end,
        })),
      },
    },
  }
}

function sessionWith(assemblies: ReturnType<typeof assembly>[]) {
  return createTestSession({ jbrowseConfig: { assemblies } })
}

// The comparative views' own path: respell and rename on the main thread with
// renameRegionsForAdapter, then hand the result to the adapter the worker
// builds from the same config.
async function featuresThroughTheViewPath(
  session: ReturnType<typeof sessionWith>,
  adapterConfig: Record<string, unknown>,
  region: Region,
  opts: ComparativeOptions = {},
) {
  const renamed = await renameRegionsForAdapter({
    assemblyManager: session.assemblyManager,
    sessionId: SESSION_ID,
    adapterConfig,
    regions: [region],
  })
  const { dataAdapter } = await getAdapter(
    getEnv(session).pluginManager,
    SESSION_ID,
    adapterConfig,
  )
  if (!isFeatureAdapter(dataAdapter)) {
    throw new Error(`${String(adapterConfig.type)} serves no features`)
  }
  return firstValueFrom(
    dataAdapter.getFeaturesInMultipleRegions(renamed, opts).pipe(toArray()),
  )
}

const MCSCAN = 'plugins/comparative-adapters/src/MCScanBlocksAdapter/test_data'

// A blocks table names its columns in `blockAssemblies` and nothing else, so a
// config naming grape by an alias there declares no `assemblyNames` at all.
test('an MCScan blocks track naming a genome by an alias in blockAssemblies answers for it', async () => {
  const features = await featuresThroughTheViewPath(
    sessionWith([
      assembly('grape', [['chr1', 1000]], ['grp']),
      assembly('peach', [['Pp1', 2000]]),
      assembly('cacao', [['Tc1', 6000]]),
    ]),
    {
      type: 'MCScanBlocksAdapter',
      mcscanBlocksLocation: local(`${MCSCAN}/grape.blocks`),
      blockAssemblies: ['grp', 'peach', 'cacao'],
      bedLocations: [
        local(`${MCSCAN}/grape.bed`),
        local(`${MCSCAN}/peach.bed`),
        local(`${MCSCAN}/cacao.bed`),
      ],
    },
    { assemblyName: 'grape', refName: 'chr1', start: 0, end: 1000 },
    { targetAssemblyName: 'peach' },
  )
  // g1, g2 and g4 have a peach ortholog; g3 does not
  expect(features).toHaveLength(3)
})

const STAR =
  'plugins/comparative-adapters/src/MultiPairwiseSyntenyAdapter/test_data'

// A star names no assembly of its own: its anchor and mates are what its
// children name, and here the children name the anchor by an alias.
test('a multi-pairwise track whose children name the anchor by an alias answers for it', async () => {
  const features = await featuresThroughTheViewPath(
    sessionWith([
      assembly(
        'anchor',
        [
          ['ctgA', 30000],
          ['ctgB', 30000],
          ['ctgC', 30000],
        ],
        ['anc'],
      ),
      assembly('genomeB', [
        ['bctg1', 20000],
        ['bctg2', 20000],
      ]),
      assembly('genomeC', [
        ['cctg1', 40000],
        ['cctg2', 40000],
      ]),
    ]),
    {
      type: 'MultiPairwiseSyntenyAdapter',
      adapters: [
        {
          type: 'PAFAdapter',
          pafLocation: local(`${STAR}/b_vs_anchor.paf`),
          assemblyNames: ['genomeB', 'anc'],
        },
        {
          type: 'PAFAdapter',
          pafLocation: local(`${STAR}/anchor_vs_c.paf`),
          assemblyNames: ['anc', 'genomeC'],
        },
      ],
    },
    { assemblyName: 'anchor', refName: 'ctgA', start: 0, end: 30000 },
  )
  expect(features.map(f => f.get('mate'))).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ assemblyName: 'genomeB', refName: 'bctg1' }),
      expect.objectContaining({ assemblyName: 'genomeC', refName: 'cctg1' }),
    ]),
  )
})
