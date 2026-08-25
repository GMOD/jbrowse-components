import createJexlInstance from '@jbrowse/core/util/jexl'

import { collectRenderData } from '../RenderFeatureDataRPC/collectRenderData.ts'
import { layoutSubfeatures } from '../RenderFeatureDataRPC/glyphs/subfeatures.ts'
import { ROOT_CHILD_ORDINAL } from '../RenderFeatureDataRPC/rpcTypes.ts'
import { mockDisplayConfig } from '../RenderFeatureDataRPC/testUtils.ts'
import { computeLaidOutData } from './layout.ts'

import type { LayoutRegionData } from './layout.ts'
import type { Feature } from '@jbrowse/core/util'

const jexl = createJexlInstance()

function mockFeature(opts: {
  type: string
  name: string
  start: number
  end: number
  subfeatures?: Feature[]
}): Feature {
  const { subfeatures = [], ...rest } = opts
  const map: Record<string, unknown> = { strand: 1, subfeatures, ...rest }
  return {
    get: (key: string) => map[key],
    id: () => `${opts.type}-${opts.name}`,
    parent: () => undefined,
  } as unknown as Feature
}

// Three named coding transcripts. The MIDDLE one has the longest CDS, so the
// ranking keeps it at k = 1 while the drawn order puts it second: a trim that
// dropped a suffix, or one that shifted nothing, keeps the wrong picture.
const GENE = mockFeature({
  type: 'gene',
  name: 'GENE1',
  start: 100,
  end: 3100,
  subfeatures: ['a', 'b', 'c'].map((name, i) =>
    mockFeature({
      type: 'mRNA',
      name,
      start: 100 + i * 1000,
      end: 1000 + i * 1000,
      subfeatures: [
        mockFeature({
          type: 'CDS',
          name: `${name}-cds`,
          start: 100 + i * 1000,
          end: (name === 'b' ? 900 : 400) + i * 1000,
        }),
      ],
    }),
  ),
})

// The real pipeline — worker layout, worker collect, main-thread pack — with
// the worker stamping the ordinals itself. The layout-level tests build their
// regions with `packStackedGenes`, whose ordinals are pre-stamped, so this is
// the one place a missing stamp on the worker side can fail.
function layoutAt(maxIsoformsPerGene: number | undefined) {
  const config = mockDisplayConfig({
    subfeatureLabels: 'below',
    labels: { name: "jexl:get(feature,'name')", description: '' },
  } as any)
  const packed = collectRenderData({
    layouts: [layoutSubfeatures({ feature: GENE, config, jexl })],
    regionStart: 0,
    regionEnd: 10_000,
    config,
    colorByCDS: false,
    jexl,
  })
  const raw = {
    ...packed,
    featureCount: 1,
    regionKey: 'volvox:ctgA',
  } as unknown as LayoutRegionData
  return computeLaidOutData(new Map([[0, raw]]), {
    bpPerPx: 1,
    showLabels: true,
    showDescriptions: false,
    reversedRegions: new Set<number>(),
    displayMode: 'normal',
    pinnedFeatureIds: new Set<string>(),
    maxIsoformsPerGene,
  }).get(0)!
}

describe('the trim through the worker pipeline', () => {
  const full = layoutAt(undefined)
  const trimmed = layoutAt(1)
  const gene = trimmed.flatbushItems.find(i => i.featureId === 'gene-GENE1')!
  const geneLabel = trimmed.floatingLabelsData.get('gene-GENE1')!

  it('stamps every rect with the ordinal of the transcript that drew it', () => {
    expect(full.rectChildOrdinals.length).toBe(full.rectYs.length)
    expect(new Set(full.rectChildOrdinals)).toEqual(new Set([0, 1, 2]))
  })

  it('keeps the best-ranked transcript, not the first drawn', () => {
    expect(trimmed.subfeatureInfos.filter(i => i.type === 'mRNA')).toHaveLength(
      1,
    )
    expect(
      trimmed.subfeatureInfos.find(i => i.type === 'mRNA')!.featureId,
    ).toBe('mRNA-b')
    const rectOrdinals = new Set(trimmed.rectChildOrdinals)
    rectOrdinals.delete(ROOT_CHILD_ORDINAL)
    expect(rectOrdinals).toEqual(new Set([1]))
  })

  it('drops the labels of the transcripts it dropped', () => {
    const transcriptLabels = [...trimmed.floatingLabelsData.values()].filter(
      label => label.parentFeatureId === 'gene-GENE1',
    )
    expect(transcriptLabels.map(label => label.featureId)).toEqual(['mRNA-b'])
  })

  it('moves the kept transcript and its label up to the top of the gene', () => {
    const kept = trimmed.subfeatureInfos.find(i => i.featureId === 'mRNA-b')!
    expect(kept.topPx).toBe(gene.topPx)
    expect(kept.labelRowsAbove).toBe(0)
    const keptLabel = trimmed.floatingLabelsData.get('mRNA-b')!
    expect(keptLabel.topY).toBe(gene.topPx)
    expect(keptLabel.labelRowsAbove).toBe(0)
    expect(keptLabel.featureHeight).toBe(
      full.floatingLabelsData.get('mRNA-b')!.featureHeight,
    )
  })

  it('shrinks the gene to what it draws and says what it is missing', () => {
    expect(gene.featureHeightPx).toBeLessThan(
      full.flatbushItems.find(i => i.featureId === 'gene-GENE1')!
        .featureHeightPx,
    )
    expect(gene.startBp).toBe(1100)
    expect(gene.endBp).toBe(2000)
    expect(geneLabel.moreIsoformsLabel).toMatchObject({
      text: '+2 more',
      hidden: 2,
    })
  })
})
