import {
  HEIGHT_MULTIPLIERS,
  ROW_PADDING,
  budgetFeatureHeightPx,
  labelFontSize,
} from '../RenderFeatureDataRPC/glyphs/glyphUtils.ts'
import { layoutSubfeatures } from '../RenderFeatureDataRPC/glyphs/subfeatures.ts'
import { mockDisplayConfig } from '../RenderFeatureDataRPC/testUtils.ts'
import { geneRowCostPx, isoformRowBudget } from './isoformBudget.ts'

import type {
  DisplayMode,
  DisplayConfig,
} from '../RenderFeatureDataRPC/renderConfig.ts'
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

// One coding transcript, named so `below` mode reserves a label row under it
// (reservesBelowLabelRow) — the shape the budget is about.
function transcript(i: number) {
  return mockFeature({
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
  })
}

// A childless non-transcript hanging off a gene — an NCBI source record, a
// `biological_region`. `isIsoform` excludes it and the cap deliberately keeps
// it, so it takes a body row and an inter-transcript gap out of the same lane.
// Every other one is nameless, because `below` reserves a label row only under a
// child with a name and the budget has to hold for both.
function decoration(i: number) {
  return mockFeature({
    type: 'biological_region',
    name: i % 2 === 0 ? `region${i}` : '',
    start: 100 + i,
    end: 600 + i,
  })
}

// A polyprotein CDS: ONE isoform by `isIsoform`, drawing a row per cleavage
// product (layoutMatureProteinRegion). What an enterovirus or a SARS-CoV-2
// ORF1ab is — test_data carries both.
function polyprotein(products: number) {
  return mockFeature({
    type: 'CDS',
    name: 'polyprotein',
    start: 100,
    end: 100 + products * 300,
    subfeatures: Array.from({ length: products }, (_, i) =>
      mockFeature({
        type: 'mat_peptide',
        name: `nsp${i + 1}`,
        start: 100 + i * 300,
        end: 300 + i * 300,
      }),
    ),
  })
}

// A gene of n coding transcripts, optionally carrying the two shapes an isoform
// COUNT cannot describe. `effectiveMaxIsoforms` runs on the main thread before
// the fetch, off config and track height alone, so it sees neither — and both
// take real rows out of the lane it is sizing.
function geneWith(
  isoforms: number,
  extra: { decorations?: number; cleavageProducts?: number } = {},
) {
  const { decorations = 0, cleavageProducts = 0 } = extra
  return mockFeature({
    type: 'gene',
    name: 'GENE1',
    start: 100,
    end: 100 + (isoforms + cleavageProducts + 1) * 1000,
    subfeatures: [
      ...Array.from({ length: isoforms }, (_, i) => transcript(i)),
      ...(cleavageProducts > 0 ? [polyprotein(cleavageProducts)] : []),
      ...Array.from({ length: decorations }, (_, i) => decoration(i)),
    ],
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
  feature: Feature,
  displayMode: DisplayMode,
  config: DisplayConfig,
) {
  const layout = layoutSubfeatures({ feature, config })
  const labelFontPx = labelFontSize(displayMode)
  const labelLines = displayMode === 'collapsed' ? 0 : 2
  return (
    layout.height * HEIGHT_MULTIPLIERS[displayMode] +
    (layout.labelRows ?? 0) * labelFontPx +
    ROW_PADDING[displayMode] +
    labelLines * labelFontPx
  )
}

// The row budget the display solves for a lane this tall, and the config it
// hands the worker as `maxIsoforms`.
function laneBudget(
  trackHeightPx: number,
  displayMode: DisplayMode,
  subfeatureLabels: DisplayConfig['subfeatureLabels'],
) {
  return isoformRowBudget(
    trackHeightPx,
    geneRowCostPx({
      featureHeightPx: 10,
      displayMode,
      subfeatureLabelsBelow: subfeatureLabels === 'below',
    }),
  )
}

function cappedConfig(
  trackHeightPx: number,
  displayMode: DisplayMode,
  subfeatureLabels: DisplayConfig['subfeatureLabels'],
) {
  return mockDisplayConfig({
    subfeatureLabels,
    geneGlyphMode: 'all',
    maxIsoforms: laneBudget(trackHeightPx, displayMode, subfeatureLabels),
  })
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
        packedRowHeightPx(geneWith(n), displayMode, config),
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
        packedRowHeightPx(geneWith(n), displayMode, config),
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
      packedRowHeightPx(geneWith(3), 'normal', config),
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
      expect(
        packedRowHeightPx(geneWith(n), displayMode, config),
      ).toBeLessThanOrEqual(trackHeightPx)
      expect(
        packedRowHeightPx(geneWith(n + 1), displayMode, config),
      ).toBeGreaterThan(trackHeightPx)
    }
  })

  // However short the lane, a gene collapsed to nothing is not an overview of
  // it — and the worker's own cap floors at 1 too (isoformsWithinBudget).
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

// `isoformRowBudget` counts ISOFORMS, and `layoutSubfeatures` packs CHILDREN.
// Two shapes make those different numbers, and the main thread can see neither
// before the fetch, so the worker is what has to spend them — see
// `isoformsWithinBudget` in subfeatures.ts.
describe('the lane holds a capped gene whatever else it carries', () => {
  // A gene hangs decorations beside its isoforms and the cap deliberately keeps
  // them, so each is a body row plus an inter-transcript gap the isoform count
  // never spent. A 100px lane packed 97px with none of them, 109px with one,
  // 121px with two and 133px with three — the gene's own name row below the
  // bottom edge, and the lane's scrollbar back.
  // Every decoration count the lane has room for: a decoration is a whole row
  // the cap may not drop, so `decorations < budget` is the range where a row is
  // still left for an isoform. Past it the gene overflows by construction, which
  // the floor case at the end of this block pins.
  it.each(MODES)('%s, with decorations beside the isoforms', displayMode => {
    for (const trackHeightPx of [60, 100, 175, 325]) {
      const config = cappedConfig(trackHeightPx, displayMode, 'none')
      for (
        let decorations = 1;
        decorations < laneBudget(trackHeightPx, displayMode, 'none');
        decorations++
      ) {
        const gene = geneWith(8, { decorations })
        expect(
          packedRowHeightPx(gene, displayMode, config),
        ).toBeLessThanOrEqual(trackHeightPx)
        // the decorations survive and at least one isoform does too, so a lane
        // that fits by drawing nothing would fail here
        expect(
          layoutSubfeatures({ feature: gene, config }).children.length,
        ).toBeGreaterThan(decorations)
      }
    }
  })

  // `below` reserves a label row under every child that has a name, so a named
  // decoration spends a body row AND a label row while a nameless one spends
  // only the body row. `isoformsWithinBudget` holds the two as separate budgets
  // because a label row's height is the display mode's, which the worker never
  // learns.
  it.each(MODES)('%s, with subfeature labels below', displayMode => {
    for (const trackHeightPx of [100, 175, 325]) {
      const config = cappedConfig(trackHeightPx, displayMode, 'below')
      for (
        let decorations = 1;
        decorations < laneBudget(trackHeightPx, displayMode, 'below');
        decorations++
      ) {
        const gene = geneWith(8, { decorations })
        expect(
          packedRowHeightPx(gene, displayMode, config),
        ).toBeLessThanOrEqual(trackHeightPx)
      }
    }
  })

  // A polyprotein CDS is ONE isoform drawing one row per cleavage product, and
  // the count charged it one row. Two transcripts beside an 8-product
  // polyprotein sit under a cap of 6 on the count alone, and packed 131px into a
  // 100px lane.
  //
  // The lane has to be one the polyprotein itself fits, because it is the
  // isoform the cap keeps: a polyprotein codes for the gene's longest protein,
  // so it ranks first, and what ranks first is what the cap may not drop. A
  // shorter lane overflows the way the floor case below does — the gene no
  // longer fits by dropping the polyprotein, which is what it used to do.
  it.each([2, 5, 8, 16])(
    'charges a polyprotein isoform each of its %i rows',
    cleavageProducts => {
      const lanePx = 10 * cleavageProducts + 30
      const config = cappedConfig(lanePx, 'normal', 'none')
      for (const isoforms of [1, 2, 4]) {
        const gene = geneWith(isoforms, { cleavageProducts })
        expect(packedRowHeightPx(gene, 'normal', config)).toBeLessThanOrEqual(
          lanePx,
        )
        expect(
          layoutSubfeatures({ feature: gene, config })
            .children.map(c => c.feature.get('name'))
            .includes('polyprotein'),
        ).toBe(true)
      }
    },
  )

  // What the cap may never drop it can never get under, and a lane shorter than
  // that floor overflows however the budget is spent. Two things sit on the
  // floor: one isoform, because a gene collapsed to nothing is not an overview
  // of it, and every decoration, because dropping those was its own bug (see
  // layoutSubfeatures).
  //
  // Three spellings of the one limit, and nothing about it is
  // polyprotein-specific — a lone 16-product polyprotein in a 100px lane, one
  // plain transcript in a 30px lane, and eight decorations in a lane holding six
  // rows all overflow the same way. The lone polyprotein reports nothing
  // collapsed, which is honest: the cap dropped nothing because it had nothing
  // it was allowed to drop.
  it('cannot get under what it may not drop', () => {
    const config = cappedConfig(100, 'normal', 'none')
    const lonePolyprotein = geneWith(0, { cleavageProducts: 16 })
    expect(packedRowHeightPx(lonePolyprotein, 'normal', config)).toBe(187)
    expect(
      layoutSubfeatures({ feature: lonePolyprotein, config }).isoformsCollapsed,
    ).toBe(false)

    expect(laneBudget(100, 'normal', 'none')).toBe(6)
    expect(
      packedRowHeightPx(geneWith(8, { decorations: 8 }), 'normal', config),
    ).toBeGreaterThan(100)

    const shortLane = cappedConfig(30, 'normal', 'none')
    expect(laneBudget(30, 'normal', 'none')).toBe(1)
    expect(packedRowHeightPx(geneWith(3), 'normal', shortLane)).toBeGreaterThan(
      30,
    )
  })
})
