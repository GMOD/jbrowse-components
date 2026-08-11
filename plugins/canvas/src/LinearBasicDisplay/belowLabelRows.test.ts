import { resolvePalette } from '@jbrowse/core/ui/palette'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { collectRenderData } from '../RenderFeatureDataRPC/collectRenderData.ts'
import { labelFontSize } from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { layoutSubfeatures } from '../RenderFeatureDataRPC/glyphs/subfeatures.ts'
import { mockDisplayConfig } from '../RenderFeatureDataRPC/testUtils.ts'
import { computeLaidOutData } from './layout.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { Feature } from '@jbrowse/core/util'

const jexl = createJexlInstance()
const palette = resolvePalette()

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

// A gene with three named mRNAs, each a single-exon transcript — the shape that
// stacks inside one row and so the shape a `below` label row has to be reserved
// within.
function geneWithTranscripts(names: string[]) {
  return mockFeature({
    type: 'gene',
    name: 'GENE1',
    start: 100,
    end: 100 + names.length * 1000,
    subfeatures: names.map((name, i) =>
      mockFeature({
        type: 'mRNA',
        name,
        start: 100 + i * 1000,
        end: 600 + i * 1000,
        subfeatures: [
          mockFeature({
            type: 'CDS',
            name: `${name}-cds`,
            start: 100 + i * 1000,
            end: 600 + i * 1000,
          }),
        ],
      }),
    ),
  })
}

// Runs the real pipeline — worker layout, worker collect, main-thread pack —
// and returns the laid-out region for one display mode.
function layoutAt(displayMode: DisplayMode, subfeatureLabels: string) {
  const config = mockDisplayConfig({ subfeatureLabels } as any)
  const layout = layoutSubfeatures({
    feature: geneWithTranscripts(['mRNA-a', 'mRNA-b', 'mRNA-c']),
    config,
  })
  const packed = collectRenderData({
    layouts: [layout],
    regionStart: 0,
    regionEnd: 10_000,
    config,
    palette,
    colorByCDS: false,
    jexl,
  })
  const raw = { ...packed, featureCount: 1 } as unknown as FeatureDataResult
  return computeLaidOutData(new Map([[0, raw]]), {
    bpPerPx: 1,
    regionKeys: new Map([[0, 'volvox:ctgA']]),
    showLabels: true,
    showDescriptions: false,
    reversedRegions: new Set<number>(),
    displayMode,
    pinnedFeatureIds: new Set<string>(),
  }).get(0)!
}

// Transcript rows in draw order, as [top, bottom].
function transcriptRows(data: FeatureDataResult) {
  return data.subfeatureInfos
    .filter(i => i.type === 'mRNA')
    .map(i => [i.topPx, i.bottomPx] as const)
    .sort((a, b) => a[0] - b[0])
}

// The bug this file exists for: the worker reserved the `below` label row as a
// raw LABEL_FONT_SIZE in normal-mode units, which the main thread then scaled by
// HEIGHT_MULTIPLIERS along with the geometry — while the label itself draws at
// the gentler LABEL_FONT_MULTIPLIERS. So the reserved gap came out SMALLER than
// the text (6.6px against 9.35px in compact, 3.3px against 7.7px in
// superCompact), every `below` label lay across the transcript under it, and the
// shortfall accumulated down the gene's stack.
describe('below subfeature-label rows survive compact scaling', () => {
  const modes: DisplayMode[] = ['normal', 'compact', 'superCompact']

  it.each(modes)('leaves a full label line between transcripts (%s)', mode => {
    const rows = transcriptRows(layoutAt(mode, 'below'))
    expect(rows).toHaveLength(3)

    const drawnLabelPx = labelFontSize(mode)
    for (let i = 1; i < rows.length; i++) {
      // gap between one transcript's BODY bottom and the next one's top. The hit
      // box (bottomPx) already covers the label row, so measure from the body:
      // top + the body height the previous row reports.
      const gap = rows[i]![0] - rows[i - 1]![1]
      // bottomPx includes the owned label row, so a non-negative gap here means
      // the label row fits with the next transcript starting at or after it
      expect(gap).toBeGreaterThanOrEqual(0)
    }
    // and the row a label occupies is the size the label is actually drawn at
    const ownedRow = rows[0]![1] - rows[0]![0]
    const bodyOnly = transcriptRows(layoutAt(mode, 'none'))[0]!
    expect(ownedRow - (bodyOnly[1] - bodyOnly[0])).toBeCloseTo(drawnLabelPx, 5)
  })

  it('costs nothing when below-labels are off', () => {
    for (const mode of modes) {
      const withLabels = layoutAt(mode, 'below')
      const without = layoutAt(mode, 'none')
      // the label rows are the ONLY difference; with them off the pass is
      // length-zero on the wire and adds no pixels
      expect(without.rectLabelRows.length).toBe(0)
      expect(withLabels.rectLabelRows.length).toBeGreaterThan(0)
    }
  })

  // superCompact is where the old arithmetic was worst: it reserved 3.3px for a
  // 7.7px label, so each of the three transcripts lost 4.4px to its neighbour.
  it('scales the label row on label units, not on geometry units', () => {
    const compact = transcriptRows(layoutAt('compact', 'below'))
    const superCompact = transcriptRows(layoutAt('superCompact', 'below'))
    const rowOf = (rows: readonly (readonly [number, number])[]) =>
      rows[0]![1] - rows[0]![0]
    // the bodies shrink on HEIGHT_MULTIPLIERS (0.6 -> 0.3, halving), but the
    // label row shrinks only on LABEL_FONT_MULTIPLIERS (0.85 -> 0.7), so the
    // labeled row must NOT halve between the two modes
    expect(rowOf(superCompact)).toBeGreaterThan(rowOf(compact) / 2)
  })
})
