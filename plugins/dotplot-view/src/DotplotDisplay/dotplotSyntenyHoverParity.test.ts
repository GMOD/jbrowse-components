import PluginManager from '@jbrowse/core/PluginManager'
import { SimpleFeature } from '@jbrowse/core/util'

import {
  getTooltipLines,
  sharedByOf,
} from '../../../linear-comparative-view/src/LinearSyntenyDisplay/components/util.ts'
import { getFeatureAtIndex } from '../../../linear-comparative-view/src/LinearSyntenyDisplay/model.ts'
import { executeSyntenyFeaturesAndPositions } from '../../../linear-comparative-view/src/LinearSyntenyRPC/executeSyntenyFeaturesAndPositions.ts'
import { Dotplot1DView } from '../DotplotView/1dview.ts'
import { getDotplotTooltipLines } from './dotplotTooltip.ts'
import { executeDotplotFeaturesAndPositions } from './executeDotplotFeaturesAndPositions.ts'

import type { Region } from '@jbrowse/core/util'

// FGFR2 pairs with three mouse genes, as an MCScan table states a tandem array:
// one row per pair, each naming both genes
function mcscanRow(id: string, mateName: string, mateStart: number) {
  return new SimpleFeature({
    uniqueId: id,
    refName: 'chr10',
    start: 1000,
    end: 2000,
    strand: 1,
    name: 'FGFR2',
    assemblyName: 'hg38',
    syntenicDepth: 3,
    mate: {
      refName: 'chr7',
      start: mateStart,
      end: mateStart + 1000,
      assemblyName: 'mm39',
      name: mateName,
    },
  })
}

const mockFeatures = [
  mcscanRow('fgfr2', 'Fgfr2', 5000),
  mcscanRow('fgfr2b', 'Fgfr2b', 8000),
  mcscanRow('fgfr2c', 'Fgfr2c', 2000),
]

jest.mock('@jbrowse/core/data_adapters/getFeatureAdapter', () => ({
  getFeatureAdapterOrThrow: async () => ({
    getFeaturesInMultipleRegionsArray: async () => mockFeatures,
  }),
}))

function region(assemblyName: string, refName: string): Region {
  return { assemblyName, refName, start: 0, end: 10_000 }
}

const human = region('hg38', 'chr10')
const mouse = region('mm39', 'chr7')
const mouseReversed = { ...mouse, reversed: true }

function axis(displayed: Region) {
  const view = Dotplot1DView.create({
    bpPerPx: 1,
    offsetPx: 0,
    displayedRegions: [displayed],
  })
  view.setVolatileWidth(500)
  return view
}

async function dotplotHover(mateName: string, mouseAxis: Region) {
  const { value } = await executeDotplotFeaturesAndPositions({
    pluginManager: new PluginManager(),
    sessionId: 'dotplot',
    adapterConfig: { type: 'MCScanAnchorsAdapter' },
    regions: [human],
    hViewSnap: { bpPerPx: 1, displayedRegions: [human] },
    vViewSnap: { bpPerPx: 1, displayedRegions: [mouseAxis] },
  })
  const featureIdx = [...value.mateNameIds].findIndex(
    id => value.mateNameDict[id] === mateName,
  )
  return getDotplotTooltipLines({
    rpcData: value,
    featureIdx,
    hview: axis(human),
    vview: axis(mouseAxis),
  })
}

async function syntenyHover(id: string, mouseAxis: Region) {
  const { value } = await executeSyntenyFeaturesAndPositions({
    pluginManager: new PluginManager(),
    sessionId: 'synteny',
    adapterConfig: { type: 'MCScanAnchorsAdapter' },
    queryView: {
      bpPerPx: 1,
      offsetPx: 0,
      width: 800,
      displayedRegions: [human],
      fetchRegions: [human],
    },
    targetView: {
      bpPerPx: 1,
      offsetPx: 0,
      displayedRegions: [mouseAxis],
      windowRegions: [mouseAxis],
    },
  })
  const feat = getFeatureAtIndex(value, value.featureIds.indexOf(id))
  return getTooltipLines(feat, undefined, sharedByOf(value, feat))
}

test('a dotplot hover over an ortholog row reads as the synteny hover does', async () => {
  const dotplot = await dotplotHover('Fgfr2', mouse)
  expect(dotplot).toEqual([
    'hg38 FGFR2 chr10:1,001-2,000 (1,000 bp)',
    'mm39 Fgfr2 chr7:5,001-6,000 (1,000 bp)',
    'Shared by 3 genes: Fgfr2c, Fgfr2, Fgfr2b',
  ])
  expect(dotplot).toEqual(await syntenyHover('fgfr2', mouse))
})

test('the genes sharing an ortholog keep genome order on a reversed axis', async () => {
  const dotplot = await dotplotHover('Fgfr2', mouseReversed)
  expect(dotplot.at(-1)).toBe('Shared by 3 genes: Fgfr2c, Fgfr2, Fgfr2b')
  expect(dotplot).toEqual(await syntenyHover('fgfr2', mouseReversed))
})
