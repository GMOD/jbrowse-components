import BedPlugin from '@jbrowse/plugin-bed'
import FeaturesPlugin, { isLinearBasicDisplay } from '@jbrowse/plugin-features'
import GFF3Plugin from '@jbrowse/plugin-gff3'

import { createTablesEngine } from '../index.ts'
import { GFF3 } from '../volvox.fixture.ts'
import { VOLVOX_CONTIGS, standUpDisplay } from './testEnv.ts'

import type * as ExecuteRenderFeatureData from '../../../../plugins/features/src/RenderFeatureDataRPC/executeRenderFeatureData.ts'
import type { RpcExecuteArgs } from '@jbrowse/core/rpc/RpcRegistry'
import type { LinearBasicDisplayModel } from '@jbrowse/plugin-features'

const mockFetches: RpcExecuteArgs<'RenderFeatureData'>[] = []

jest.mock(
  '../../../../plugins/features/src/RenderFeatureDataRPC/executeRenderFeatureData.ts',
  () => {
    const actual = jest.requireActual<typeof ExecuteRenderFeatureData>(
      '../../../../plugins/features/src/RenderFeatureDataRPC/executeRenderFeatureData.ts',
    )
    return {
      ...actual,
      executeRenderFeatureData: (
        call: Parameters<typeof actual.executeRenderFeatureData>[0],
      ) => {
        mockFetches.push(call.args)
        return actual.executeRenderFeatureData(call)
      },
    }
  },
)

const engine = createTablesEngine()

const region = { refName: 'ctgA', start: 1000, end: 2000 }

const NOT_SETTINGS = new Set([
  'sessionId',
  'statusCallback',
  'stopToken',
  'signal',
  'adapterConfig',
  'sequenceAdapter',
  'region',
  'regions',
  'byteLimit',
  'maxFeatureDensity',
])

function settingsOf(args: RpcExecuteArgs<'RenderFeatureData'>) {
  return Object.fromEntries(
    Object.entries(args).filter(([key]) => !NOT_SETTINGS.has(key)),
  )
}

async function fetchedSettings({
  display,
  bpPerPx,
  colorByFrame,
  showAminoAcids,
}: {
  display: Record<string, unknown>
  bpPerPx: number
  colorByFrame: boolean
  showAminoAcids: boolean
}) {
  mockFetches.length = 0
  const { dispose } = await standUpDisplay<LinearBasicDisplayModel>({
    plugins: [new FeaturesPlugin(), new GFF3Plugin(), new BedPlugin()],
    track: { type: 'FeatureTrack', adapter: GFF3.adapterConfig },
    displayType: 'LinearBasicDisplay',
    isDisplay: isLinearBasicDisplay,
    displayConfig: display,
    regions: [region],
    contigLengths: VOLVOX_CONTIGS,
    bpPerPx,
    viewToggles: { colorByFrame, showAminoAcids },
  })
  dispose()
  const displayFetch = mockFetches.at(-1)
  mockFetches.length = 0
  await engine.features({
    adapterConfig: GFF3.adapterConfig,
    sequenceAdapter: GFF3.sequenceAdapter,
    regions: [region],
    bpPerPx,
    display,
    colorByFrame,
    aminoAcids: showAminoAcids,
  })
  const [tableFetch] = mockFetches
  return {
    display: displayFetch && settingsOf(displayFetch),
    table: tableFetch && settingsOf(tableFetch),
  }
}

test.each([
  { bpPerPx: 0.5, colorByFrame: false, showAminoAcids: true, peptides: true },
  { bpPerPx: 0.5, colorByFrame: true, showAminoAcids: false, peptides: false },
  { bpPerPx: 5, colorByFrame: true, showAminoAcids: true, peptides: false },
])(
  'the table sends the worker what the display sends at $bpPerPx bp/px, amino acids $showAminoAcids',
  async ({ peptides, ...frame }) => {
    for (const display of [{}, { geneGlyphMode: 'representative' }]) {
      const fetched = await fetchedSettings({ display, ...frame })
      expect(fetched.display?.peptides).toBe(peptides)
      expect(fetched.table).toEqual(fetched.display)
    }
  },
)
