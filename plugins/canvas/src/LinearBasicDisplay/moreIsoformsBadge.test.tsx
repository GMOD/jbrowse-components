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
import type { LayoutInputs } from './layoutInputs.ts'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

const jexl = createJexlInstance()

// `mockDisplayConfig` leaves the label slots empty, which resolves to no
// name, and the badge only exists beside one.
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

// `name` is deliberately not defaulted: a default parameter fires on an
// explicit `undefined` too, which would quietly name the gene in the nameless
// case.
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

  it('keeps the count on a gene the user opened', () => {
    const region = trimmedRegion(layoutGene(9), 3, new Set(['gene1']))
    expect(region.rectYs.length).toBe(
      trimmedRegion(layoutGene(9)).rectYs.length,
    )
    expect(
      region.floatingLabelsData.get('gene1')!.moreIsoformsLabel,
    ).toMatchObject({ hidden: 6, expanded: true })
  })

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

    expect(badgeAt(drawnBp / (MIN_ISOFORM_BADGE_GENE_PX * 2))).toMatchObject({
      hidden: 3,
      expanded: false,
    })
    expect(badgeAt(drawnBp / (MIN_ISOFORM_BADGE_GENE_PX / 5))).toBeUndefined()
  })

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

  it('drops a trimmed gene’s badge once it is too narrow to carry one', () => {
    const wide = labelsAt(9, 3).get('gene1')!
    expect(drawnPx(wide)).toBeGreaterThan(MIN_ISOFORM_BADGE_GENE_PX)
    expect(wide.moreIsoformsLabel).toMatchObject({ hidden: 6 })

    const narrow = labelsAt(9, 3, { bpPerPx: 100 }).get('gene1')!
    expect(drawnPx(narrow, 100)).toBeLessThan(MIN_ISOFORM_BADGE_GENE_PX)
    expect(narrow.moreIsoformsLabel).toBeUndefined()
  })

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

  it('is absent on a gene with no name', () => {
    expect(
      labelsAt(9, 3, { name: undefined }).get('gene1')?.moreIsoformsLabel,
    ).toBeUndefined()
  })

  it("bakes its width at the size it draws, not the name's", () => {
    const badge = labelsAt(9, 3).get('gene1')!.moreIsoformsLabel!
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
    expect(withBadge - withoutBadge).toBeCloseTo(
      data.moreIsoformsLabel!.textWidth / 2 + LABEL_PADDING_PX,
    )
  })
})

const overhangPx = (text: string, fontSize: number) =>
  measureText(text, fontSize) + LABEL_PADDING_PX

const BADGE_GENE_NAME = 'GENE1-WITH-A-NAME-LONG-ENOUGH'
const BADGE_GENE_END_BP = MIN_ISOFORM_BADGE_GENE_PX + 10

const NEIGHBOUR_BP = Math.round(
  overhangPx(BADGE_GENE_NAME, LABEL_FONT_SIZE) +
    overhangPx('+6 more', LABEL_FONT_SIZE * MORE_ISOFORMS_FONT_SCALE) / 2,
)

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
  expect(overhangPx(BADGE_GENE_NAME, LABEL_FONT_SIZE)).toBeGreaterThan(
    BADGE_GENE_END_BP,
  )
  expect(BADGE_GENE_END_BP).toBeGreaterThan(MIN_ISOFORM_BADGE_GENE_PX)

  expect(rowOfNeighbour(3)).toBe(0)
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
    expect(badge.title).toBe('6 isoforms not shown — click to expand this gene')
    const x = (el: HTMLElement) =>
      Number(/translate\(([-\d.]+)px/.exec(el.style.transform)![1])
    expect(x(badge)).toBeGreaterThan(x(name))
  })

  it('draws smaller than the name it qualifies', () => {
    const { getByTestId } = renderLabelLayer({})
    const size = (el: HTMLElement) => Number.parseFloat(el.style.fontSize)
    expect(size(getByTestId('feature-more-isoforms-gene1'))).toBeCloseTo(
      size(getByTestId('feature-name-GENE1')) * MORE_ISOFORMS_FONT_SCALE,
    )
  })

  it("sits on the name's baseline, not above it", () => {
    const { getByTestId } = renderLabelLayer({})
    const baseline = (el: HTMLElement) =>
      Number(/translate\([-\d.]+px, ([-\d.]+)px/.exec(el.style.transform)![1]) +
      Number.parseFloat(el.style.fontSize) * LABEL_BASELINE_RATIO
    expect(baseline(getByTestId('feature-more-isoforms-gene1'))).toBeCloseTo(
      baseline(getByTestId('feature-name-GENE1')),
    )
  })

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

  it('goes wherever the name goes', () => {
    const { queryByTestId } = renderLabelLayer({ renderedShowLabels: false })
    expect(queryByTestId('feature-more-isoforms-gene1')).toBeNull()
  })
})

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

  expect(collapseRow()).toBeUndefined()

  display.toggleExpandedGene('gene1')
  display.toggleExpandedGene('gene2')
  expect(String(collapseRow()!.label)).toBe('Collapse 2 expanded genes')

  collapseRow()!.onClick()
  expect(display.expandedGeneIds).toHaveLength(0)
  expect(collapseRow()).toBeUndefined()
})
