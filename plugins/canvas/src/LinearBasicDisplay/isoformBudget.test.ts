import {
  HEIGHT_MULTIPLIERS,
  ROW_PADDING,
  labelFontSize,
} from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { layoutSubfeatures } from '../RenderFeatureDataRPC/glyphs/subfeatures.ts'
import { mockDisplayConfig } from '../RenderFeatureDataRPC/testUtils.ts'
import {
  budgetFeatureHeightPx,
  geneRowCostPx,
  isoformRowBudget,
} from './isoformBudget.ts'

import type { DisplayMode } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { DisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'

function mockFeature(opts: {
  type: string
  name: string
  start: number
  end: number
  subfeatures?: Feature[]
}): Feature {
  const { type, name, start, end, subfeatures = [] } = opts
  return {
    get: (key: string) =>
      ({ type, name, start, end, strand: 1, subfeatures })[key],
    id: () => `${type}-${name}-${start}-${end}`,
    parent: () => undefined,
  } as unknown as Feature
}

// A gene of n coding transcripts, each with a name so `below` mode reserves a
// label row under it (reservesBelowLabelRow) — the shape the budget is about.
function geneWith(isoforms: number) {
  return mockFeature({
    type: 'gene',
    name: 'GENE1',
    start: 100,
    end: 100 + isoforms * 1000,
    subfeatures: Array.from({ length: isoforms }, (_, i) =>
      mockFeature({
        type: 'mRNA',
        name: `tx${i}`,
        start: 100 + i * 1000,
        end: 500 + i * 1000,
        subfeatures: [
          mockFeature({
            type: 'CDS',
            name: `cds${i}`,
            start: 100 + i * 1000,
            end: 400 + i * 1000,
          }),
        ],
      }),
    ),
  })
}

// The row height `decideLabelReservations` (layout.ts) gives this gene, rebuilt
// here from the worker layout it is handed. Deliberately spelled out rather than
// imported: the point of the test is that the budget's own arithmetic agrees
// with the packer's, and importing the packer's would make the comparison
// vacuous.
//
//   bodyHeightPx = workerHeight × multiplier + labelRows × labelFontPx
//   rowHeight    = bodyHeightPx + rowPadding + labelLines × labelFontPx
//
// labelLines is 2 — a name and a description, the worst case the budget spends
// (see MAX_FEATURE_LABEL_LINES) and what a labeled gene actually draws.
function packedRowHeightPx(
  isoforms: number,
  displayMode: DisplayMode,
  config: DisplayConfig,
) {
  const layout = layoutSubfeatures({ feature: geneWith(isoforms), config })
  const labelFontPx = labelFontSize(displayMode)
  const labelLines = displayMode === 'collapsed' ? 0 : 2
  return (
    layout.height * HEIGHT_MULTIPLIERS[displayMode] +
    (layout.labelRows ?? 0) * labelFontPx +
    ROW_PADDING[displayMode] +
    labelLines * labelFontPx
  )
}

const MODES: DisplayMode[] = ['normal', 'compact', 'superCompact', 'collapsed']

describe('budgetFeatureHeightPx', () => {
  it('takes a plain numeric slot', () => {
    expect(budgetFeatureHeightPx(14)).toBe(14)
  })

  // `featureHeight` declares `contextVariable: ['feature']`, so the slot may hold
  // a jexl string. Only the worker can resolve one per feature; evaluating it
  // here (with no feature) throws out of a getter rpcProps() reads, which broke
  // fetching outright. Fall back to the height the worker's own resolver falls
  // back to.
  it.each([
    [`jexl:get(feature,'score')>10?20:10`],
    [0],
    [-5],
    [undefined],
    [null],
  ])('falls back rather than trusting %p', raw => {
    expect(budgetFeatureHeightPx(raw)).toBe(10)
  })
})

// The budget is a MIRROR of the packer's row arithmetic, and a mirror that
// drifts silently admits an isoform past the lane it exists to fit — which is
// the whole bug the cap was introduced to end. So pin the two together directly
// rather than through the display.
describe('geneRowCostPx mirrors the packed row height', () => {
  it.each(MODES)('%s, subfeature labels off', displayMode => {
    const config = mockDisplayConfig({ subfeatureLabels: 'none' })
    const cost = geneRowCostPx({
      featureHeightPx: 10,
      displayMode,
      subfeatureLabelsBelow: false,
    })
    for (const n of [1, 2, 5, 13]) {
      expect(n * cost.perIsoformPx + cost.geneOwnPx).toBeCloseTo(
        packedRowHeightPx(n, displayMode, config),
        6,
      )
    }
  })

  // `below` puts a label row under every transcript — at a 10px feature it is
  // nearly as tall as the transcript, so a budget that doesn't spend it admits
  // about twice what the lane holds.
  it.each(MODES)('%s, subfeature labels below', displayMode => {
    const config = mockDisplayConfig({ subfeatureLabels: 'below' })
    const cost = geneRowCostPx({
      featureHeightPx: 10,
      displayMode,
      subfeatureLabelsBelow: true,
    })
    for (const n of [1, 2, 5, 13]) {
      expect(n * cost.perIsoformPx + cost.geneOwnPx).toBeCloseTo(
        packedRowHeightPx(n, displayMode, config),
        6,
      )
    }
  })

  // A non-default body height has to flow through the whole mirror, not just the
  // bodies: the inter-transcript gap is a fraction of it too.
  it('tracks a non-default feature height', () => {
    const config = mockDisplayConfig({ featureHeight: 24 })
    const cost = geneRowCostPx({
      featureHeightPx: 24,
      displayMode: 'normal',
      subfeatureLabelsBelow: false,
    })
    expect(3 * cost.perIsoformPx + cost.geneOwnPx).toBeCloseTo(
      packedRowHeightPx(3, 'normal', config),
      6,
    )
  })
})

describe('isoformRowBudget', () => {
  // The budget is the LARGEST n that fits, and n+1 must not — an off-by-one here
  // is a lane that scrolls anyway, which is the failure the cap exists to end.
  it.each(MODES)('admits exactly what the lane holds in %s', displayMode => {
    const config = mockDisplayConfig({ subfeatureLabels: 'none' })
    const cost = geneRowCostPx({
      featureHeightPx: 10,
      displayMode,
      subfeatureLabelsBelow: false,
    })
    for (const trackHeightPx of [60, 100, 175, 325, 600]) {
      const n = isoformRowBudget(trackHeightPx, cost)
      expect(packedRowHeightPx(n, displayMode, config)).toBeLessThanOrEqual(
        trackHeightPx,
      )
      expect(packedRowHeightPx(n + 1, displayMode, config)).toBeGreaterThan(
        trackHeightPx,
      )
    }
  })

  // However short the lane, a gene collapsed to nothing is not an overview of
  // it — and the worker's own cap floors at 1 too (isoformsWithinCap).
  it('never drops below one isoform', () => {
    const cost = geneRowCostPx({
      featureHeightPx: 10,
      displayMode: 'normal',
      subfeatureLabelsBelow: true,
    })
    expect(isoformRowBudget(1, cost)).toBe(1)
    expect(isoformRowBudget(0, cost)).toBe(1)
  })

  // A taller lane can only ever hold more, and a costlier row can only ever hold
  // fewer. Both directions are what the display's chip promises the user.
  it('is monotone in the lane height and in the row cost', () => {
    const cheap = geneRowCostPx({
      featureHeightPx: 10,
      displayMode: 'normal',
      subfeatureLabelsBelow: false,
    })
    const dear = geneRowCostPx({
      featureHeightPx: 10,
      displayMode: 'normal',
      subfeatureLabelsBelow: true,
    })
    let prev = 0
    for (const h of [50, 100, 200, 400, 800]) {
      const n = isoformRowBudget(h, cheap)
      expect(n).toBeGreaterThanOrEqual(prev)
      expect(isoformRowBudget(h, dear)).toBeLessThanOrEqual(n)
      prev = n
    }
  })
})
