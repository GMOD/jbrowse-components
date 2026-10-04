import { createJBrowseTheme } from '@jbrowse/core/ui'
import { legendSpecOf } from '@jbrowse/core/ui/colorScale'
import { leftAxisGutterWidth } from '@jbrowse/display-ui'
import { clusterLayout } from '@jbrowse/tree-sidebar'
import { ThemeProvider } from '@mui/material'
import { renderToString } from 'react-dom/server'

import { processFeaturesFromArrays } from '../util.ts'
import { renderSvg } from './renderSvg.tsx'

import type { RenderSvgModel } from './renderSvg.tsx'
import type {
  ClusterHierarchyNode,
  HierarchyNode,
  NewickNode,
  SvgSidebarProps,
} from '@jbrowse/tree-sidebar'
import type React from 'react'

// renderDisplaySvg reaches the containing view for its geometry, and the model
// here is a plain object; awaitSvgReady awaits a mobx `when`, which a model with
// no fetch lifecycle never satisfies.
const mockView = {
  width: 800,
  offsetPx: 0,
  dynamicBlocks: { contentBlocks: [{ refName: 'ctgA', start: 0, end: 1000 }] },
  visibleRegions: [
    {
      refName: 'ctgA',
      start: 0,
      end: 1000,
      screenStartPx: 0,
      screenEndPx: 800,
      reversed: false,
      displayedRegionIndex: 0,
    },
  ],
}
jest.mock('@jbrowse/core/util', () => ({
  ...jest.requireActual('@jbrowse/core/util'),
  getContainingView: () => mockView,
}))
// foundationView.ts resolves `getContainingView` through this leaf module,
// not the barrel above, so it needs its own mock.
jest.mock('@jbrowse/core/util/mstUtils', () => ({
  ...jest.requireActual('@jbrowse/core/util/mstUtils'),
  getContainingView: () => mockView,
}))
jest.mock('mobx', () => ({
  ...jest.requireActual('mobx'),
  when: () => Promise.resolve(),
}))

const ticks = {
  yTop: 0,
  yBottom: 50,
  items: [
    { value: 0, y: 50, label: '0' },
    { value: 10, y: 0, label: '10' },
  ],
}

// The one scale the rows share, as `ScoreScaleMixin` resolves it off the
// model's `valueScales`: a band per row, past the dendrogram where one shows,
// and no band at all for density rows in their own colours.
function axes({ left = 0, density = false, grid = false } = {}) {
  return [
    {
      domain: [0, 10] as [number, number],
      scaleType: 'linear',
      height: 50,
      offset: 0,
      ticks,
      bandTops: density ? [] : [0, 50],
      left,
      grid,
    },
  ]
}

// Two sources, each one bar spanning the left half of the region, so the paint
// layer has something to serialize.
function makeRegionData() {
  const arrays = processFeaturesFromArrays({
    starts: new Int32Array([0]),
    ends: new Int32Array([500]),
    scores: new Float32Array([5]),
    minScores: undefined,
    maxScores: undefined,
    count: 1,
  })
  return {
    sources: [
      { name: 'a', ...arrays },
      { name: 'b', ...arrays },
    ],
  }
}

// A two-leaf dendrogram positioned by the real layout, so SvgTreePath exercises
// the same geometry the on-screen tree does.
function makeHierarchy(): ClusterHierarchyNode {
  const leaf = (name: string): HierarchyNode<NewickNode> => ({
    data: { name },
    children: null,
    parent: null,
    depth: 1,
    height: 0,
  })
  const a = leaf('a')
  const b = leaf('b')
  const root: HierarchyNode<NewickNode> = {
    data: { name: '' },
    children: [a, b],
    parent: null,
    depth: 0,
    height: 1,
  }
  a.parent = root
  b.parent = root
  return clusterLayout(root, 100, 40)
}

function makeModel(
  overrides: Partial<RenderSvgModel> = {},
  sidebar: Partial<SvgSidebarProps> = {},
): RenderSvgModel {
  return {
    id: 'test',
    height: 100,
    // rows edge-to-edge over the full height, two of them
    plotGeometry: { yTop: 0, plotHeight: 100, numRows: 2, tickHeight: 50 },
    error: undefined,
    regionTooLarge: false,
    svgReady: true,
    rpcDataMap: new Map([[0, makeRegionData()]]),
    renderState: {
      domainY: [0, 10],
      scaleType: 0,
      symlogConstant: 1,
      renderingType: 0,
      canvasWidth: 800,
      canvasHeight: 100,
      numRows: 2,
      diameterPx: 2,
      lineWidth: 1,
      origin: 0,
      pivot: 0,
      cuts: [0],
      innerColors: [],
    },
    gpuProps: () => ({
      sources: [{ name: 'a' }, { name: 'b' }],
      rowLayout: true,
      perSource: false,
      origin: 0,
      wiggleColor: {
        posColor: '#0068d1',
        negColor: '#e01e26',
        pivot: 0,
        cuts: [0],
        innerColors: [],
        rampLut: null,
        rampMid: undefined,
      },
      effectiveSummaryScoreMode: 'avg',
      renderingType: 'xyplot',
      isDensityMode: false,
      maxGapMultiple: 0,
    }),
    svgSidebar: {
      showTree: false,
      hierarchy: undefined,
      sources: [{ name: 'a' }, { name: 'b' }],
      rowHeight: 50,
      treeAreaWidth: 40,
      leftInset: leftAxisGutterWidth(overrides.axes ?? axes()),
      ...sidebar,
    },
    isOverlay: false,
    isDensityMode: false,
    effectiveRowHeight: 50,
    rowsTopOffset: 0,
    numRows: 2,
    axes: axes(),
    canvasWidthPx: 800,
    showRowSeparators: false,
    ...overrides,
  }
}

// The members `renderDisplaySvg` detects a `LegendMixin` host by, over one
// source key; the fixture is a plain object, so they are spelled out.
function withKey(showLegend: boolean) {
  return {
    showLegend,
    legendSpec: legendSpecOf([
      {
        kind: 'categorical',
        id: 'sources',
        entries: [
          { value: 'a', label: 'a', color: '#f00' },
          { value: 'b', label: 'b', color: '#00f' },
        ],
      },
    ]),
    setShowLegend() {},
    dismissLegendSection() {},
  }
}

function render(result: React.ReactNode) {
  return renderToString(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg width={800} height={100} viewBox="0 0 800 100">
        {result as React.ReactElement}
      </svg>
    </ThemeProvider>,
  )
}

describe('MultiLinearWiggleDisplay renderSvg', () => {
  it('paints one bar per row, each in its own row band', async () => {
    const html = render(await renderSvg(makeModel()))
    // PaintLayer with no rasterizeLayers serializes an SvgCanvas, so the bars
    // arrive as vector fills rather than an embedded PNG.
    expect(html).not.toContain('<image')
    expect(html).toContain('clip-path="url(#display-clip-test)"')
    // 0..500 of a 1000bp region over 800px is 400px, plus the Canvas2D fudge
    // factor. Score 5 of a [0,10] domain fills the lower half of a 50px row, so
    // row 0's bar sits at y=25 and row 1's at y=75 — the per-row placement the
    // export shares with the screen.
    expect(html).toContain('<rect x="0" y="25" width="400.8" height="25"')
    expect(html).toContain('<rect x="0" y="75" width="400.8" height="25"')
    expect(html).toContain('fill="rgb(0,104,209)"')
  })

  // the circular view's rings sample the canvas, which carries no labels
  it('leaves the row labels out of a plot-only export', async () => {
    const html = render(await renderSvg(makeModel(), { plotOnly: true }))
    expect(html).not.toContain('>a</text>')
    expect(html).toContain('fill="rgb(0,104,209)"')
  })

  it('draws a per-row axis and the row labels', async () => {
    const html = render(await renderSvg(makeModel()))
    // one scalebar per row, and both row names
    expect(html).toContain('>a</text>')
    expect(html).toContain('>b</text>')
  })

  it('parks the labels left of the 50px axis strip', async () => {
    const html = render(await renderSvg(makeModel()))
    expect(html).toContain('translate(-66.65625 0)')
  })

  it('draws the dendrogram and the labels in the margin, past the axis strip', async () => {
    const html = render(
      await renderSvg(
        makeModel(
          { axes: axes({ left: 40 }) },
          { showTree: true, hierarchy: makeHierarchy() },
        ),
      ),
    )
    expect(html).toContain('stroke="#0008"')
    expect(html).toContain('translate(-106.65625 0)')
    expect(html).toContain('translate(40 0)')
  })

  // The scalebars stay beside the plot in the export margin whether or not a
  // tree is showing; the tree and labels sit left of them.
  it('keeps the per-row axes beside the plot when a tree is showing', async () => {
    const gutterXs = (html: string) =>
      [
        ...html.matchAll(
          /<g transform="translate\((-?\d+) \d+\)"><g transform="translate\(50 0\)">/g,
        ),
      ].map(m => Number(m[1]))
    expect(gutterXs(render(await renderSvg(makeModel())))).toEqual([-50, -50])
    expect(
      gutterXs(
        render(
          await renderSvg(
            makeModel(
              { axes: axes({ left: 40 }) },
              { showTree: true, hierarchy: makeHierarchy() },
            ),
          ),
        ),
      ),
    ).toEqual([-50, -50])
  })

  it('omits the dendrogram when the tree is hidden', async () => {
    expect(
      render(await renderSvg(makeModel({}, { hierarchy: makeHierarchy() }))),
    ).not.toContain('stroke="#0008"')
  })

  it('draws the overlay color key only when it applies', async () => {
    const shown = render(
      await renderSvg(
        makeModel({ isOverlay: true, ...withKey(true) }, { showLabels: false }),
      ),
    )
    expect(shown).toContain('>a</text>')
    const dismissed = render(
      await renderSvg(
        makeModel(
          { isOverlay: true, ...withKey(false) },
          { showLabels: false },
        ),
      ),
    )
    // overlay draws no row labels, so with the key off there is no 'a' anywhere
    expect(dismissed).not.toContain('>a</text>')
  })

  // The caption and the key are pinned to the content's right edge and both
  // draw from y=0, so a density track whose rows carry their own colors —
  // which is exactly when a short-rowed track gets BOTH — used to print the
  // key on top of the score range. The caption is the shell's, for a scale
  // that rules no band, and the shell starts the key below it.
  it('stacks the color key below the score caption rather than over it', async () => {
    const html = render(
      await renderSvg(
        makeModel({
          isDensityMode: true,
          axes: axes({ density: true }),
          ...withKey(true),
        }),
      ),
    )
    expect(html).toContain('[0, 10]')
    expect(html).toContain('<g transform="translate(0 16)">')
  })

  // Shared with the on-screen path so an exported figure matches the track.
  it('carries the row separators and cross hatches into the export', async () => {
    const html = render(
      await renderSvg(
        makeModel({ showRowSeparators: true, axes: axes({ grid: true }) }),
      ),
    )
    expect(html).toContain('stroke="rgb(200,200,200)"')
    expect(html).toContain('y1="50.5"')
  })

  // not "draws an error box instead of the body": an export is a standalone
  // figure, so a source whose data wouldn't load fails the whole export rather
  // than reserving the track's height for a message nobody downstream will read
  it('fails the export when the model errored', async () => {
    await expect(
      renderSvg(makeModel({ error: new Error('boom') })),
    ).rejects.toThrow('Cannot export: Error: boom')
  })
})
