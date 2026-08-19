import { createJBrowseTheme } from '@jbrowse/core/ui'
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
} from '@jbrowse/tree-sidebar'
import type React from 'react'

// renderDisplaySvg reaches the containing view for its geometry, and the model
// here is a plain object; awaitSvgReady awaits a mobx `when`, which a model with
// no fetch lifecycle never satisfies.
const mockView = {
  width: 800,
  offsetPx: 0,
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
jest.mock('mobx', () => ({
  ...jest.requireActual('mobx'),
  when: () => Promise.resolve(),
}))

const ticks = {
  values: [0, 10],
  yTop: 0,
  yBottom: 50,
  items: [
    { value: 0, y: 50, label: '0' },
    { value: 10, y: 0, label: '10' },
  ],
}

// Two sources, each one bar spanning the left half of the region, so the paint
// layer has something to serialize.
function makeRegionData() {
  const arrays = processFeaturesFromArrays(
    {
      starts: new Int32Array([0]),
      ends: new Int32Array([500]),
      scores: new Float32Array([5]),
      minScores: undefined,
      maxScores: undefined,
      count: 1,
    },
    0,
  )
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

function makeModel(overrides: Partial<RenderSvgModel> = {}): RenderSvgModel {
  return {
    id: 'test',
    height: 100,
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
      scatterPointSize: 2,
      lineWidth: 1,
      origin: 0,
    },
    gpuProps: () => ({
      sources: [{ name: 'a' }, { name: 'b' }],
      posColor: '#0068d1',
      negColor: '#e01e26',
      effectiveSummaryScoreMode: 'avg',
      renderingType: 'multirowxy',
      isDensityMode: false,
      bicolorPivot: 0,
      maxGapMultiple: 0,
    }),
    showTree: false,
    treeAreaWidth: 40,
    hierarchy: undefined,
    clusterProvenance: undefined,
    sources: [{ name: 'a' }, { name: 'b' }],
    legendItems: [
      { color: '#0068d1', label: 'a' },
      { color: '#0068d1', label: 'b' },
    ],
    isOverlay: false,
    isDensityMode: false,
    effectiveRowHeight: 50,
    domain: [0, 10],
    scaleType: 'linear',
    ticks,
    rowHeightTooSmallForScalebar: false,
    numSources: 2,
    numRows: 2,
    scoreRamp: undefined,
    showRowSeparators: false,
    showRowLabels: true,
    showCrossHatches: false,
    hasOverlayLegend: false,
    ...overrides,
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
    expect(html).toContain('clip-path="url(#wiggle-clip-test)"')
    // 0..500 of a 1000bp region over 800px is 400px, plus the Canvas2D fudge
    // factor. Score 5 of a [0,10] domain fills the lower half of a 50px row, so
    // row 0's bar sits at y=25 and row 1's at y=75 — the per-row placement the
    // export shares with the screen.
    expect(html).toContain('<rect x="0" y="25" width="400.8" height="25"')
    expect(html).toContain('<rect x="0" y="75" width="400.8" height="25"')
    expect(html).toContain('fill="rgb(0,104,209)"')
  })

  it('draws a per-row axis and the row labels', async () => {
    const html = render(await renderSvg(makeModel()))
    // one scalebar per row, and both row names
    expect(html).toContain('>a</text>')
    expect(html).toContain('>b</text>')
  })

  // The dendrogram is the display's own, not the shared SvgTreeSidebar: the row
  // labels live in MultiWiggleSvgScales. Both derive their offset from
  // treeSidebarOffset, so a blank gutter can't appear.
  it('draws the dendrogram and shifts the labels past it', async () => {
    const html = render(
      await renderSvg(
        makeModel({ showTree: true, hierarchy: makeHierarchy() }),
      ),
    )
    expect(html).toContain('stroke="#0008"')
    // past the 40px gutter AND past the 50px axis strip beyond it, plus the
    // 4px gap — the same place the on-screen path puts them
    expect(html).toContain('translate(94 0)')
  })

  // The axes are left-oriented: their ticks and numbers occupy the strip that
  // ends where they are anchored. With no dendrogram that strip is the export
  // margin and the anchor is the content's left edge; a gutter sits between the
  // two, so an axis left there ran its spine down the whole height of the tree
  // panel. Same strip the screen gives it, on the other side of the gutter.
  it('anchors the per-row axes past the tree gutter rather than inside it', async () => {
    const axisXs = (html: string) =>
      [...html.matchAll(/<g transform="translate\((\d+)\)">/g)].map(m =>
        Number(m[1]),
      )
    expect(axisXs(render(await renderSvg(makeModel())))).toEqual([0])
    expect(
      axisXs(
        render(
          await renderSvg(
            makeModel({ showTree: true, hierarchy: makeHierarchy() }),
          ),
        ),
      ),
    ).toEqual([90])
  })

  it('omits the dendrogram when the tree is hidden', async () => {
    expect(
      render(await renderSvg(makeModel({ hierarchy: makeHierarchy() }))),
    ).not.toContain('stroke="#0008"')
  })

  // The locus travels with the figure — a shared link otherwise hands over a
  // dendrogram with no way to learn where it was computed.
  it('captions a computed tree with its locus', async () => {
    const html = render(
      await renderSvg(
        makeModel({
          showTree: true,
          hierarchy: makeHierarchy(),
          clusterProvenance: {
            regions: [{ refName: 'ctgA', start: 0, end: 1000 }],
          },
        }),
      ),
    )
    expect(html).toContain('ctgA')
  })

  // On screen the same `legendItems` go to FloatingLegend; here they are drawn
  // inline. Both read hasOverlayLegend, so a legend the user dismissed stays out
  // of the export rather than reappearing in the figure.
  it('draws the overlay color key only when it applies', async () => {
    const shown = render(
      await renderSvg(makeModel({ isOverlay: true, hasOverlayLegend: true })),
    )
    expect(shown).toContain('>a</text>')
    const dismissed = render(
      await renderSvg(makeModel({ isOverlay: true, hasOverlayLegend: false })),
    )
    // overlay draws no row labels, so with the key off there is no 'a' anywhere
    expect(dismissed).not.toContain('>a</text>')
  })

  // Both legends are pinned to the content's right edge and both draw from
  // y=0, so the density case — which is exactly when a short-rowed track gets
  // BOTH a score legend and a color key — used to print the key on top of the
  // score range.
  it('stacks the color key below the score legend rather than over it', async () => {
    const html = render(
      await renderSvg(
        makeModel({
          isDensityMode: true,
          hasOverlayLegend: true,
          legendItems: [
            { color: '#f00', label: 'a' },
            { color: '#00f', label: 'b' },
          ],
        }),
      ),
    )
    // the score range text legend, then the key pushed clear of its 16px band
    expect(html).toContain('[0, 10]')
    expect(html).toContain('<g transform="translate(0 16)">')
  })

  // Shared with the on-screen path so an exported figure matches the track.
  it('carries the row separators and cross hatches into the export', async () => {
    const html = render(
      await renderSvg(
        makeModel({ showRowSeparators: true, showCrossHatches: true }),
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
