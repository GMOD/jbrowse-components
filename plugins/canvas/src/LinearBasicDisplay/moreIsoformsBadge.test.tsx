import { createJBrowseTheme } from '@jbrowse/core/ui'
import { resolvePalette } from '@jbrowse/core/ui/palette'
import { measureText } from '@jbrowse/core/util'
import createJexlInstance from '@jbrowse/core/util/jexl'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import { collectRenderData } from '../RenderFeatureDataRPC/collectRenderData.ts'
import {
  LABEL_FONT_SIZE,
  MORE_ISOFORMS_FONT_SCALE,
} from '../RenderFeatureDataRPC/constants.ts'
import { layoutSubfeatures } from '../RenderFeatureDataRPC/glyphs/subfeatures.ts'
import {
  makeFeatureData,
  makeFlatbushItem,
  mockDisplayConfig,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { computeLabelExtraWidth } from './components/labelPositioning.ts'
import { FloatingLabelsLayer } from './components/overlayElements.tsx'
import { computeLaidOutData } from './layout.ts'
import { createTestEnvironment } from './testEnv.ts'

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
// go silently wrong: the worker counts, the packer reserves width for it, the
// positioner anchors it to the name, and the label layer routes its click
// somewhere other than the three gestures that already live on a label.

const jexl = createJexlInstance()
const palette = resolvePalette()

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
    maxIsoforms?: number
    expandedGeneIds?: ReadonlySet<string>
    name?: string | undefined
  } = {},
) {
  const feature = geneWith(n, 'name' in overrides ? overrides.name : 'GENE1')

  return layoutSubfeatures({
    feature,
    config: labelledConfig({ maxIsoforms: overrides.maxIsoforms }),
    jexl,
    expandedGeneIds: overrides.expandedGeneIds,
  })
}

describe('the worker counts what the collapse leaves out', () => {
  it('reports the hidden isoforms of a capped gene', () => {
    const layout = layoutGene(9, { maxIsoforms: 3 })
    expect(layout.children).toHaveLength(3)
    expect(layout.isoformOverflow).toEqual({ hidden: 6, expanded: false })
  })

  it('reports nothing for a gene that draws every isoform it has', () => {
    expect(layoutGene(3, { maxIsoforms: 9 }).isoformOverflow).toBeUndefined()
    expect(layoutGene(3).isoformOverflow).toBeUndefined()
  })

  // An expanded gene draws all of them but keeps reporting the count, which is
  // what lets the badge that opened it offer the way back. Were `hidden` to drop
  // to 0 here the badge would vanish on its own click and the only way to
  // re-collapse one gene would be to re-collapse the whole track.
  it('keeps the count on a gene the user opened', () => {
    const layout = layoutGene(9, {
      maxIsoforms: 3,
      expandedGeneIds: new Set(['gene1']),
    })
    expect(layout.children).toHaveLength(9)
    expect(layout.isoformOverflow).toEqual({ hidden: 6, expanded: true })
  })

  // `longestCoding` is the cap at one, so it overflows by the same arithmetic
  // rather than by a branch of its own.
  it('counts a longestCoding collapse the same way', () => {
    const feature = geneWith(4)
    const layout = layoutSubfeatures({
      feature,
      config: labelledConfig({ geneGlyphMode: 'longestCoding' }),
      jexl,
    })
    expect(layout.isoformOverflow).toEqual({ hidden: 3, expanded: false })
  })
})

function labelDataFor(
  layout: ReturnType<typeof layoutSubfeatures>,
  config = labelledConfig(),
) {
  return collectRenderData({
    layouts: [layout],
    regionStart: 0,
    regionEnd: 100_000,
    config,
    palette,
    colorByCDS: false,
    jexl,
  }).floatingLabelsData
}

describe('the badge rides the gene name label', () => {
  it('reads "+N more" collapsed and "− fewer" expanded', () => {
    expect(
      labelDataFor(layoutGene(9, { maxIsoforms: 3 })).gene1!.moreIsoformsLabel,
    ).toMatchObject({ text: '+6 more', hidden: 6, expanded: false })

    expect(
      labelDataFor(
        layoutGene(9, { maxIsoforms: 3, expandedGeneIds: new Set(['gene1']) }),
      ).gene1!.moreIsoformsLabel,
    ).toMatchObject({ text: 'show fewer', hidden: 6, expanded: true })
  })

  it('is absent where nothing is collapsed', () => {
    expect(labelDataFor(layoutGene(3)).gene1!.moreIsoformsLabel).toBeUndefined()
  })

  // The badge qualifies a name, so a gene the annotation never named has none to
  // qualify — floating one alone under the glyph would read as a transcript
  // label rather than as this gene's own missing count.
  it('is absent on a gene with no name', () => {
    const data = labelDataFor(
      layoutGene(9, { maxIsoforms: 3, name: undefined }),
    )
    expect(data.gene1?.moreIsoformsLabel).toBeUndefined()
  })

  // The width every consumer that has to cover the label re-derives — the hit
  // box, the highlight overlay, the SVG export's boxes. The badge is drawn AFTER
  // the name on the same row, so all of them have to reserve both or the box
  // stops at the name and the badge hangs outside its own feature.
  it("bakes its width at the size it draws, not the name's", () => {
    const badge = labelDataFor(layoutGene(9, { maxIsoforms: 3 })).gene1!
      .moreIsoformsLabel!
    // `renderedTextWidth` scales every baked width from LABEL_FONT_SIZE, so
    // measuring the badge at the smaller size is what makes each reservation
    // land on the width it paints without knowing there are two sizes in play.
    expect(badge.textWidth).toBeCloseTo(
      measureText(badge.text, LABEL_FONT_SIZE * MORE_ISOFORMS_FONT_SCALE),
    )
  })

  it('counts toward the label width the hit box and highlight reserve', () => {
    const data = labelDataFor(layoutGene(9, { maxIsoforms: 3 })).gene1!
    const withBadge = computeLabelExtraWidth(data, 0)
    const withoutBadge = computeLabelExtraWidth(
      { ...data, moreIsoformsLabel: undefined },
      0,
    )
    expect(withBadge).toBeGreaterThan(withoutBadge)
    expect(withBadge - withoutBadge).toBeCloseTo(
      data.moreIsoformsLabel!.textWidth,
    )
  })
})

const INPUTS: LayoutInputs = {
  bpPerPx: 1,
  showLabels: true,
  showDescriptions: false,
  reversedRegions: new Set<number>(),
  displayMode: 'normal',
  pinnedFeatureIds: new Set<string>(),
}

// Two features 50bp apart, the left one carrying a 30px name — which clears the
// gap — plus a badge of `badgeWidth`, which may not. The packer widens a
// feature's layout span by its reserved label overhang, so a badge left out of
// the reservation is text drawn straight over the neighbour.
function twoFeatures(badgeWidth: number | undefined) {
  const label = (text: string, textWidth: number) => ({
    text,
    relativeY: 0,
    color: 'black',
    textWidth,
  })
  return new Map([
    [
      0,
      {
        regionKey: 'v:ctgA',
        ...makeFeatureData({
          flatbushItems: [
            makeFlatbushItem({ featureId: 'gene1', startBp: 0, endBp: 10 }),
            makeFlatbushItem({ featureId: 'gene2', startBp: 60, endBp: 70 }),
          ],
          floatingLabelsData: {
            gene1: {
              featureId: 'gene1',
              minX: 0,
              maxX: 10,
              topY: 0,
              featureHeight: 10,
              nameLabel: label('GENE1', 30),
              moreIsoformsLabel:
                badgeWidth === undefined
                  ? undefined
                  : {
                      ...label('+6 more', badgeWidth),
                      hidden: 6,
                      expanded: false,
                    },
            },
          },
        }),
      },
    ],
  ])
}

const rowOfNeighbour = (badgeWidth: number | undefined) =>
  computeLaidOutData(twoFeatures(badgeWidth), INPUTS).get(0)!.flatbushItems[1]!
    .topPx

test('the packer reserves the badge width alongside the name', () => {
  // the name alone stops short of the neighbour, so both sit on row 0
  expect(rowOfNeighbour(undefined)).toBe(0)
  // the badge carries the reservation past it, so the neighbour takes a row of
  // its own rather than being painted over
  expect(rowOfNeighbour(40)).toBeGreaterThan(0)
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

const BADGE_DATA = {
  ...collectRenderData({
    layouts: [layoutGene(9, { maxIsoforms: 3 })],
    regionStart: 0,
    regionEnd: 100_000,
    config: labelledConfig({ maxIsoforms: 3 }),
    palette,
    colorByCDS: false,
    jexl,
  }),
  featureCount: 1,
}

function renderLabelLayer(overrides: Record<string, unknown>) {
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
      <FloatingLabelsLayer model={model} view={VIEW} />
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

  // The badge is anchored to the end of the name text, so a badge outliving its
  // name would sit at the feature's left edge claiming isoforms of whatever
  // glyph it landed on.
  it('goes wherever the name goes', () => {
    const { queryByTestId } = renderLabelLayer({ renderedShowLabels: false })
    expect(queryByTestId('feature-more-isoforms-gene1')).toBeNull()
  })
})

// The collapse is `layoutSubfeatures`', which only the worker runs — so the set
// has to reach it as an RPC argument, and a click has to invalidate the cache
// the same way hiding or soloing a feature does.
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
    const subMenu = geneGlyph && 'subMenu' in geneGlyph ? geneGlyph.subMenu : []
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
