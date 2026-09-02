import { createJBrowseTheme, resolveSubMenu } from '@jbrowse/core/ui'
import { measureText } from '@jbrowse/core/util'
import createJexlInstance from '@jbrowse/core/util/jexl'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { collectRenderData } from '../RenderFeatureDataRPC/collectRenderData.ts'
import {
  LABEL_BASELINE_RATIO,
  LABEL_FONT_SIZE,
  LABEL_PADDING_PX,
  MORE_ISOFORMS_FONT_SCALE,
} from '../RenderFeatureDataRPC/constants.ts'
import { layoutSubfeatures } from '../RenderFeatureDataRPC/glyphs/subfeatures.ts'
import {
  mockDisplayConfig,
  packStackedGenes,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { computeLabelExtraWidth } from './components/labelPositioning.ts'
import { FloatingLabelsLayer } from './components/overlayElements.tsx'
import { MIN_ISOFORM_BADGE_GENE_PX } from './isoformTrim.ts'
import { computeLaidOutData } from './layout.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { DisplayConfig } from '../RenderFeatureDataRPC/renderConfig.ts'
import type {
  FeatureItemEntry,
  VisibleRegion,
} from './components/hitTesting.ts'
import type { LayoutInputs } from './layout.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// The count a reader actually lacks is per gene: how many isoforms are MISSING
// from the gene they are looking at. The track-level chip could only ever report
// one number for the whole view, and reported the number KEPT — which is the one
// number any gene on screen already shows. So the count moved onto each gene's
// own name label as a clickable badge ("+3 more"), and clicking it opens that
// one gene without turning every other gene on screen into a stack.
//
// This walks the whole chain, because every link in it is a place the badge can
// go silently wrong: the trim counts, the packer reserves width for it at the
// count it is probing, the positioner anchors it to the name, and the label
// layer routes its click somewhere other than the three gestures that already
// live on a label.

const jexl = createJexlInstance()

// `mockDisplayConfig` leaves the label slots empty, which resolves to no name at
// all; the badge only exists beside one, so every case here carries the schema's
// own `labels.name` default.
function labelledConfig(
  overrides: Parameters<typeof mockDisplayConfig>[0] = {},
) {
  return mockDisplayConfig({
    labels: {
      name: `jexl:get(feature,'name') || get(feature,'id')`,
      description: '',
    },
    ...overrides,
  })
}

// `id` is the uniqueId the adapter assigns, reachable only through `id()` — the
// `id` DATA field the `labels.name` default falls back to is a separate thing a
// GFF3 may or may not carry, and the nameless case below turns on that
// difference.
function mockFeature(opts: {
  type: string
  id: string
  name?: string
  start: number
  end: number
  subfeatures?: Feature[]
}): Feature {
  const { type, name, start, end, subfeatures = [] } = opts
  const map: Record<string, unknown> = {
    type,
    start,
    end,
    strand: 1,
    subfeatures,
    ...(name === undefined ? {} : { name }),
  }
  return {
    get: (key: string) => map[key],
    id: () => opts.id,
    parent: () => undefined,
  } as unknown as Feature
}

// A gene of `n` coding isoforms — the shape the cap collapses. `name` is
// deliberately not defaulted: a default parameter fires on an explicit
// `undefined` too, which would quietly name the gene in the nameless case below.
function geneWith(n: number, name?: string) {
  return mockFeature({
    type: 'gene',
    id: 'gene1',
    name,
    start: 100,
    end: 100 + n * 1000,
    subfeatures: Array.from({ length: n }, (_, i) =>
      mockFeature({
        type: 'mRNA',
        id: `tx${i}`,
        name: `tx${i}`,
        start: 100 + i * 1000,
        end: 500 + i * 1000,
        subfeatures: [
          mockFeature({
            type: 'CDS',
            id: `cds${i}`,
            start: 100 + i * 1000,
            end: 400 + i * 1000,
          }),
        ],
      }),
    ),
  })
}

function layoutGene(
  n: number,
  overrides: {
    geneGlyphMode?: DisplayConfig['geneGlyphMode']
    expandedGeneIds?: ReadonlySet<string>
    name?: string | undefined
  } = {},
) {
  return layoutSubfeatures({
    feature: geneWith(n, 'name' in overrides ? overrides.name : 'GENE1'),
    config: labelledConfig({ geneGlyphMode: overrides.geneGlyphMode }),
    jexl,
    expandedGeneIds: overrides.expandedGeneIds,
  })
}

const INPUTS: LayoutInputs = {
  bpPerPx: 1,
  showLabels: true,
  showDescriptions: false,
  reversedRegions: new Set<number>(),
  displayMode: 'normal',
  pinnedFeatureIds: new Set<string>(),
}

// One region holding one gene, straight from the worker's own emitter.
function regionFor(layout: ReturnType<typeof layoutSubfeatures>) {
  return {
    regionKey: 'v:ctgA',
    ...collectRenderData({
      layouts: [layout],
      regionStart: 0,
      regionEnd: 100_000,
      config: labelledConfig(),
      colorByCDS: false,
      jexl,
    }),
    featureCount: 1,
  }
}

// The whole chain the badge crosses: the worker emits every isoform, the
// main-thread trim drops the losers and writes the badge onto what is left.
//
// `geneWith(n)` is n kb wide, so at the default 1 bp/px every case here is far
// clear of MIN_ISOFORM_BADGE_GENE_PX; the gate cases below name a bpPerPx that
// puts the drawn extent on the other side of it.
function trimmedRegion(
  layout: ReturnType<typeof layoutSubfeatures>,
  maxIsoformsPerGene?: number,
  expandedGeneIds?: ReadonlySet<string>,
  bpPerPx = INPUTS.bpPerPx,
) {
  return computeLaidOutData(new Map([[0, regionFor(layout)]]), {
    ...INPUTS,
    bpPerPx,
    maxIsoformsPerGene,
    expandedGeneIds,
  }).get(0)!
}

const labelsAt = (
  n: number,
  maxIsoformsPerGene?: number,
  opts: Parameters<typeof layoutGene>[1] & { bpPerPx?: number } = {},
) =>
  trimmedRegion(
    layoutGene(n, opts),
    maxIsoformsPerGene,
    opts.expandedGeneIds,
    opts.bpPerPx,
  ).floatingLabelsData

// The drawn extent of one gene's label, in px at the zoom it was packed at —
// the number the badge's width gate is about.
const drawnPx = (
  label: { minX: number; maxX: number },
  bpPerPx = INPUTS.bpPerPx,
) => (label.maxX - label.minX) / bpPerPx

describe('the trim counts what it leaves out', () => {
  it('reports the hidden isoforms of a trimmed gene', () => {
    const region = trimmedRegion(layoutGene(9), 3)
    expect(region.flatbushItems[0]!.isoformStack!.isoformCount).toBe(9)
    expect(
      region.floatingLabelsData.get('gene1')!.moreIsoformsLabel,
    ).toMatchObject({ hidden: 6, expanded: false })
  })

  it('reports nothing for a gene that draws every isoform it has', () => {
    expect(labelsAt(3, 9).get('gene1')!.moreIsoformsLabel).toBeUndefined()
    expect(labelsAt(3).get('gene1')!.moreIsoformsLabel).toBeUndefined()
  })

  // An expanded gene draws all of them and keeps reporting the count, which is
  // what lets the badge that opened it offer the way back. Were `hidden` to
  // drop to 0 here the badge would vanish on its own click and the only way to
  // re-collapse one gene would be to re-collapse the whole track.
  it('keeps the count on a gene the user opened', () => {
    const region = trimmedRegion(layoutGene(9), 3, new Set(['gene1']))
    expect(region.rectYs.length).toBe(
      trimmedRegion(layoutGene(9)).rectYs.length,
    )
    expect(
      region.floatingLabelsData.get('gene1')!.moreIsoformsLabel,
    ).toMatchObject({ hidden: 6, expanded: true })
  })

  // The badge says what the READER is not being shown, so it cannot depend on
  // which side collapsed the gene: a `longestCoding` gene draws one transcript
  // of four and, without a badge, offered no way to open it at all — the corner
  // chip names the mode, and switching the whole track's mode is not the same
  // affordance as opening the one gene you are reading (ADR-093).
  //
  // What keeps the zoomed-out crowd the mode exists for readable is the width
  // gate, which is a property of the picture rather than of the mode: at 2px a
  // gene the badge is an aside on a name pinned to nothing.
  it('badges a wide worker-collapsed gene and leaves a narrow one alone', () => {
    const layout = layoutGene(4, { geneGlyphMode: 'longestCoding' })
    expect(layout.children).toHaveLength(1)
    const stack = trimmedRegion(layout).flatbushItems[0]!.isoformStack!
    const child = stack.children[0]!
    const drawnBp = child.endBp - child.startBp
    const badgeAt = (bpPerPx: number) =>
      trimmedRegion(
        layout,
        undefined,
        undefined,
        bpPerPx,
      ).floatingLabelsData.get('gene1')!.moreIsoformsLabel

    // twice the gate wide, then a fifth of it
    expect(badgeAt(drawnBp / (MIN_ISOFORM_BADGE_GENE_PX * 2))).toMatchObject({
      hidden: 3,
      expanded: false,
    })
    expect(badgeAt(drawnBp / (MIN_ISOFORM_BADGE_GENE_PX / 5))).toBeUndefined()
  })

  // A worker-collapsed gene gets a badge and no trim, so that write is the only
  // thing the trim pass does — onto the label entry `cloneMutableFields` copied.
  // Onto the raw one it would outlive the zoom that earned it, since the raw
  // payload is what every re-pack reads.
  it('writes a badge-only gene’s badge onto the clone, not the payload', () => {
    const raw = regionFor(layoutGene(4, { geneGlyphMode: 'longestCoding' }))
    const laidOut = computeLaidOutData(new Map([[0, raw]]), INPUTS).get(0)!
    expect(
      laidOut.floatingLabelsData.get('gene1')!.moreIsoformsLabel,
    ).toBeDefined()
    expect(
      raw.floatingLabelsData.get('gene1')!.moreIsoformsLabel,
    ).toBeUndefined()
  })

  // Same gate on the ladder's own trims, so one zoom-out does not leave a
  // trimmed gene badged and a worker-collapsed one beside it bare.
  it('drops a trimmed gene’s badge once it is too narrow to carry one', () => {
    const wide = labelsAt(9, 3).get('gene1')!
    expect(drawnPx(wide)).toBeGreaterThan(MIN_ISOFORM_BADGE_GENE_PX)
    expect(wide.moreIsoformsLabel).toMatchObject({ hidden: 6 })

    const narrow = labelsAt(9, 3, { bpPerPx: 100 }).get('gene1')!
    expect(drawnPx(narrow, 100)).toBeLessThan(MIN_ISOFORM_BADGE_GENE_PX)
    expect(narrow.moreIsoformsLabel).toBeUndefined()
  })

  // And on "show fewer", which is gated on the EXPANDED extent — every isoform
  // is drawn there, so the gene is as wide as its whole stack.
  it('drops an expanded gene’s badge once it is too narrow to carry one', () => {
    const expanded = { expandedGeneIds: new Set(['gene1']) }
    expect(
      labelsAt(9, 3, expanded).get('gene1')!.moreIsoformsLabel,
    ).toMatchObject({ text: 'show fewer', expanded: true })
    expect(
      labelsAt(9, 3, { ...expanded, bpPerPx: 500 }).get('gene1')!
        .moreIsoformsLabel,
    ).toBeUndefined()
  })

  // The badge is the only way back for a gene the user opened, so it survives a
  // switch into a mode that would not have offered it — otherwise that gene
  // stands fully stacked among collapsed ones with no control on it. The mode's
  // own count rides on the stack (`collapsedIsoformCount`), because an expanded
  // gene ships every isoform and nothing else says what it was opened from.
  it('keeps the badge on an expanded gene whatever mode it lands in', () => {
    const layout = layoutGene(4, {
      geneGlyphMode: 'longestCoding',
      expandedGeneIds: new Set(['gene1']),
    })
    expect(layout.children).toHaveLength(4)
    expect(
      trimmedRegion(
        layout,
        undefined,
        new Set(['gene1']),
      ).floatingLabelsData.get('gene1')!.moreIsoformsLabel,
    ).toMatchObject({ hidden: 3, expanded: true })
  })
})

describe('the badge rides the gene name label', () => {
  it('reads "+N more" trimmed and "show fewer" expanded', () => {
    expect(labelsAt(9, 3).get('gene1')!.moreIsoformsLabel).toMatchObject({
      text: '+6 more',
      hidden: 6,
      expanded: false,
    })

    expect(
      labelsAt(9, 3, { expandedGeneIds: new Set(['gene1']) }).get('gene1')!
        .moreIsoformsLabel,
    ).toMatchObject({ text: 'show fewer', hidden: 6, expanded: true })
  })

  it('is absent where nothing is trimmed', () => {
    expect(labelsAt(3).get('gene1')!.moreIsoformsLabel).toBeUndefined()
  })

  // The badge qualifies a name, so a gene the annotation never named has none to
  // qualify — floating one alone under the glyph would read as a transcript
  // label rather than as this gene's own missing count.
  it('is absent on a gene with no name', () => {
    expect(
      labelsAt(9, 3, { name: undefined }).get('gene1')?.moreIsoformsLabel,
    ).toBeUndefined()
  })

  // The width every consumer that has to cover the label re-derives — the hit
  // box, the highlight overlay, the SVG export's boxes. The badge is drawn AFTER
  // the name on the same row, so all of them have to reserve both or the box
  // stops at the name and the badge hangs outside its own feature.
  it("bakes its width at the size it draws, not the name's", () => {
    const badge = labelsAt(9, 3).get('gene1')!.moreIsoformsLabel!
    // `renderedTextWidth` scales every baked width from LABEL_FONT_SIZE, so
    // measuring the badge at the smaller size is what makes each reservation
    // land on the width it paints without knowing there are two sizes in play.
    expect(badge.textWidth).toBeCloseTo(
      measureText(badge.text, LABEL_FONT_SIZE * MORE_ISOFORMS_FONT_SCALE),
    )
  })

  it('counts toward the label width the hit box and highlight reserve', () => {
    const data = labelsAt(9, 3).get('gene1')!
    const extra = (d: typeof data) =>
      computeLabelExtraWidth(d, 0, true, true, LABEL_FONT_SIZE)
    const withBadge = extra(data)
    const withoutBadge = extra({ ...data, moreIsoformsLabel: undefined })
    expect(withBadge).toBeGreaterThan(withoutBadge)
    // the badge AND the gap it sits after (resolveFeatureLabels places it at
    // the name's end plus a LABEL_PADDING_PX), or every box built off this
    // width stops one padding short of the text it covers
    expect(withBadge - withoutBadge).toBeCloseTo(
      data.moreIsoformsLabel!.textWidth + LABEL_PADDING_PX,
    )
  })

  it('reserves the gap at the drawn size in a compact mode', () => {
    const data = labelsAt(9, 3).get('gene1')!
    const fontSize = LABEL_FONT_SIZE / 2
    const withBadge = computeLabelExtraWidth(data, 0, true, true, fontSize)
    const withoutBadge = computeLabelExtraWidth(
      { ...data, moreIsoformsLabel: undefined },
      0,
      true,
      true,
      fontSize,
    )
    // the text halves with the mode, the padding does not — it is added after
    // the scale everywhere else too (paddedLabelWidthPx)
    expect(withBadge - withoutBadge).toBeCloseTo(
      data.moreIsoformsLabel!.textWidth / 2 + LABEL_PADDING_PX,
    )
  })
})

// The packer widens a feature's layout span by its reserved label overhang, so
// a badge left out of the reservation is text drawn straight over the
// neighbour. The badge's text depends on the count being probed, which is why
// its width is priced in `decideLabelReservations` rather than baked into the
// label the worker ships.
const overhangPx = (text: string, fontSize: number) =>
  measureText(text, fontSize) + LABEL_PADDING_PX

// The packer reserves max(box, label overhang), so the name has to be WIDER
// than the box for the badge's own width to move anything — while the box still
// has to clear MIN_ISOFORM_BADGE_GENE_PX for the badge to exist at all. Hence a
// long name over a gene ten pixels past the gate, at 1 bp/px so the bp numbers
// here are pixels.
const BADGE_GENE_NAME = 'GENE1-WITH-A-NAME-LONG-ENOUGH'
const BADGE_GENE_END_BP = MIN_ISOFORM_BADGE_GENE_PX + 10

// Just past the name's own overhang and inside the badge's, so the two cases
// below differ by the badge alone.
const NEIGHBOUR_BP = Math.round(
  overhangPx(BADGE_GENE_NAME, LABEL_FONT_SIZE) +
    overhangPx('+6 more', LABEL_FONT_SIZE * MORE_ISOFORMS_FONT_SCALE) / 2,
)

// One named gene at the origin and a plain neighbour that far along.
function rowOfNeighbour(isoforms: number, maxIsoformsPerGene?: number) {
  const region = {
    regionKey: 'v:ctgA',
    ...packStackedGenes([
      {
        featureId: 'gene1',
        startBp: 0,
        endBp: BADGE_GENE_END_BP,
        isoforms,
        name: BADGE_GENE_NAME,
      },
      {
        featureId: 'gene2',
        startBp: NEIGHBOUR_BP,
        endBp: NEIGHBOUR_BP + 10,
        isoforms: 1,
        name: '',
      },
    ]),
  }
  return computeLaidOutData(new Map([[0, region]]), {
    ...INPUTS,
    maxIsoformsPerGene,
  }).get(0)!.flatbushItems[1]!.topPx
}

test('the packer reserves the badge width alongside the name', () => {
  // the premise: the name outruns the box, and the box clears the badge's gate
  expect(overhangPx(BADGE_GENE_NAME, LABEL_FONT_SIZE)).toBeGreaterThan(
    BADGE_GENE_END_BP,
  )
  expect(BADGE_GENE_END_BP).toBeGreaterThan(MIN_ISOFORM_BADGE_GENE_PX)

  // the name alone stops short of the neighbour, so both sit on row 0
  expect(rowOfNeighbour(3)).toBe(0)
  // trimming 9 to 3 adds a "+6 more" badge, whose reservation carries past the
  // neighbour — so it takes a row of its own rather than being painted over
  expect(rowOfNeighbour(9, 3)).toBeGreaterThan(0)
})

const VR: VisibleRegion = {
  refName: 'ctgA',
  displayedRegionIndex: 0,
  start: 0,
  end: 100_000,
  assemblyName: 'volvox',
  screenStartPx: 0,
  screenEndPx: 1000,
}

const VIEW = {
  initialized: true,
  trackWidthPx: 1000,
  bpPerPx: 100,
  visibleRegions: [VR],
} as unknown as LinearGenomeViewModel

const BADGE_DATA = trimmedRegion(layoutGene(9), 3)

function renderLabelLayer(
  overrides: Record<string, unknown>,
  hover: {
    onLabelMouseOver?: (item: unknown) => void
    onLabelMouseLeave?: () => void
  } = {},
) {
  const model = {
    renderedShowLabels: true,
    renderedShowSubfeatureLabels: true,
    renderedShowDescriptions: false,
    canvasWidthPx: 1000,
    labelFontSize: 11,
    height: 100,
    contentHeight: 100,
    labelScrollBucket: 0,
    featureItemMap: new Map<string, FeatureItemEntry>([
      [
        'gene1',
        {
          kind: 'feature',
          item: BADGE_DATA.flatbushItems[0]!,
          vr: VR,
          data: BADGE_DATA,
        },
      ],
    ]),
    renderDataMap: new Map([[0, BADGE_DATA]]),
    openContextMenu: () => {},
    selectFeatureById: () => {},
    toggleSoloFeature: () => {},
    toggleExpandedGene: () => {},
    ...overrides,
  }
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <FloatingLabelsLayer model={model} view={VIEW} {...hover} />
    </ThemeProvider>,
  )
}

describe('the badge in the label layer', () => {
  // A badge is a control sharing a layer with three gestures that already act on
  // the feature. Routed by the feature id alone it would open the gene's details
  // widget, which is the click it is standing next to.
  it('routes its click to the expansion, not to the feature', () => {
    const toggleExpandedGene = jest.fn()
    const selectFeatureById = jest.fn()
    const toggleSoloFeature = jest.fn()
    const { getByTestId } = renderLabelLayer({
      toggleExpandedGene,
      selectFeatureById,
      toggleSoloFeature,
    })

    fireEvent.click(getByTestId('feature-more-isoforms-gene1'))
    expect(toggleExpandedGene).toHaveBeenCalledWith('gene1')
    expect(selectFeatureById).not.toHaveBeenCalled()
    expect(toggleSoloFeature).not.toHaveBeenCalled()
  })

  // Three pointer paths cross this badge and only the left click is special: the
  // hover suppresses the gene's tooltip, but the right click still opens the
  // gene's context menu, because the badge sits on the gene's own label. That
  // path reads the region off the element, and half the menu's rows resolve a
  // region against it — a badge without one handed them `Number(undefined)`.
  it('right-clicks through to its gene, with a region the menu can use', () => {
    const openContextMenu = jest.fn()
    const { getByTestId } = renderLabelLayer({ openContextMenu })

    fireEvent.contextMenu(getByTestId('feature-more-isoforms-gene1'))
    expect(openContextMenu).toHaveBeenCalledTimes(1)
    const { displayedRegionIndex } = openContextMenu.mock.calls[0]![0]
    expect(displayedRegionIndex).toBe(0)
    expect(Number.isNaN(displayedRegionIndex)).toBe(false)
  })

  it('draws the badge beside the name, after it', () => {
    const { getByTestId } = renderLabelLayer({})
    const name = getByTestId('feature-name-GENE1')
    const badge = getByTestId('feature-more-isoforms-gene1')
    expect(badge.textContent).toBe('+6 more')
    // the badge has one short row, so the sentence is the hover title
    expect(badge.title).toBe('6 isoforms not shown — click to expand this gene')
    const x = (el: HTMLElement) =>
      Number(/translate\(([-\d.]+)px/.exec(el.style.transform)![1])
    expect(x(badge)).toBeGreaterThan(x(name))
  })

  // It is an aside on the name, not a second label. The size is the half that
  // can go wrong quietly: the badge's baked width is measured at this same
  // scale, so a drawn size that drifted from it would put the text and the room
  // reserved for it at different widths — the invariant every label here holds.
  it('draws smaller than the name it qualifies', () => {
    const { getByTestId } = renderLabelLayer({})
    const size = (el: HTMLElement) => Number.parseFloat(el.style.fontSize)
    expect(size(getByTestId('feature-more-isoforms-gene1'))).toBeCloseTo(
      size(getByTestId('feature-name-GENE1')) * MORE_ISOFORMS_FONT_SCALE,
    )
  })

  // Both divs are positioned by their TOP with `line-height: 1`, so equal tops
  // put the smaller badge's baseline above the name's and it reads as a
  // superscript. The two share a line, so they share a baseline.
  it("sits on the name's baseline, not above it", () => {
    const { getByTestId } = renderLabelLayer({})
    const baseline = (el: HTMLElement) =>
      Number(/translate\([-\d.]+px, ([-\d.]+)px/.exec(el.style.transform)![1]) +
      Number.parseFloat(el.style.fontSize) * LABEL_BASELINE_RATIO
    expect(baseline(getByTestId('feature-more-isoforms-gene1'))).toBeCloseTo(
      baseline(getByTestId('feature-name-GENE1')),
    )
  })

  // The badge carries a feature id so its click can find the gene, which also
  // put it on the layer's hover path: it raised the GENE's tooltip on top of its
  // own `title`, two of them on one 40px control saying different things. The
  // cursor arrives across the name, so the hover it has to undo is already set.
  it('does not raise the feature tooltip over its own', () => {
    const onLabelMouseOver = jest.fn()
    const onLabelMouseLeave = jest.fn()
    const { getByTestId } = renderLabelLayer(
      {},
      { onLabelMouseOver, onLabelMouseLeave },
    )

    fireEvent.mouseMove(getByTestId('feature-name-GENE1'))
    expect(onLabelMouseOver).toHaveBeenCalledTimes(1)

    fireEvent.mouseMove(getByTestId('feature-more-isoforms-gene1'))
    expect(onLabelMouseOver).toHaveBeenCalledTimes(1)
    expect(onLabelMouseLeave).toHaveBeenCalled()
  })

  // The badge is anchored to the end of the name text, so a badge outliving its
  // name would sit at the feature's left edge claiming isoforms of whatever
  // glyph it landed on.
  it('goes wherever the name goes', () => {
    const { queryByTestId } = renderLabelLayer({ renderedShowLabels: false })
    expect(queryByTestId('feature-more-isoforms-gene1')).toBeNull()
  })
})

// `longestCoding` is still the worker's, and an expanded gene has to escape it
// — so the set reaches the worker as an RPC argument, and a click invalidates
// the cache the same way hiding or soloing a feature does. The fit ladder's own
// trim needs no fetch (ADR-092); this is what is left.
test('an expanded gene reaches the worker as a fetch input', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()

  expect(display.rpcProps().expandedGeneIds).toBeUndefined()

  display.toggleExpandedGene('gene1')
  expect(display.rpcProps().expandedGeneIds).toEqual(['gene1'])

  display.toggleExpandedGene('gene1')
  expect(display.rpcProps().expandedGeneIds).toBeUndefined()
})

// Each badge re-collapses its own gene, which is no way back for a reader who
// opened six across a locus and has panned away from four of them.
test('the track menu offers the way back from a run of expansions', () => {
  const { createDisplay } = createTestEnvironment()
  const { display } = createDisplay()
  const collapseRow = () => {
    const items: MenuItem[] = display.trackMenuItems()
    const geneGlyph = items.find(i => 'label' in i && i.label === 'Gene glyph')
    const subMenu =
      geneGlyph && 'subMenu' in geneGlyph ? resolveSubMenu(geneGlyph) : []
    const row = subMenu.find(
      i => 'label' in i && String(i.label).startsWith('Collapse'),
    )
    return row && 'onClick' in row ? row : undefined
  }

  // absent while nothing is expanded, so the submenu stays the mode radio
  expect(collapseRow()).toBeUndefined()

  display.toggleExpandedGene('gene1')
  display.toggleExpandedGene('gene2')
  expect(String(collapseRow()!.label)).toBe('Collapse 2 expanded genes')

  collapseRow()!.onClick()
  expect(display.expandedGeneIds).toHaveLength(0)
  expect(collapseRow()).toBeUndefined()
})
