import React from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { clusterLayout } from '@jbrowse/tree-sidebar'
import { ThemeProvider } from '@mui/material'
import { renderToString } from 'react-dom/server'

import { renderSvg } from './renderSvg.tsx'

import type { MultiRowGetFeaturesResult } from '../MultiRowGetFeaturesRPC/rpcTypes.ts'
import type { RenderSvgModel } from './renderSvg.tsx'
import type {
  ClusterHierarchyNode,
  HierarchyNode,
  NewickNode,
} from '@jbrowse/tree-sidebar'

// renderSvg calls getContainingView(self) to reach the LGV; the model is a plain
// object in these tests, so intercept it. awaitSvgReady awaits mobx `when`, so
// resolve that immediately.
//
// `visibleRegions` is here rather than on the model because renderDisplaySvg
// resolves the export's render blocks from the view, once, for every display.
const mockView = {
  width: 800,
  visibleRegions: [
    {
      displayedRegionIndex: 0,
      start: 1000,
      end: 2000,
      screenStartPx: 0,
      screenEndPx: 800,
      reversed: false,
    },
  ],
}
// Stub only what renderSvg + SvgRowLabels reach for; requireActual pulls in the
// whole core/util barrel and trips a jest module-init cycle.
jest.mock('@jbrowse/core/util', () => ({
  getContainingView: () => mockView,
  measureText: (s: string, fontSize = 10) => s.length * fontSize * 0.6,
  max: (arr: number[], d = 0) => (arr.length ? Math.max(...arr) : d),
  getFillProps: (color: string) => ({ fill: color }),
  getStrokeProps: (color: string) => ({ stroke: color }),
}))
jest.mock('mobx', () => ({
  ...jest.requireActual('mobx'),
  when: () => Promise.resolve(),
}))

function makeRegionData(): MultiRowGetFeaturesResult {
  return {
    featureStarts: Uint32Array.from([1100]),
    featureEnds: Uint32Array.from([1200]),
    featureColors: Uint32Array.from([0xff0000ff]),
    partitionValues: ['a'],
    featurePartitionIndex: Uint32Array.from([0]),
    featureNames: ['feat'],
    featureIds: ['f0'],
    featureDeltas: new Int32Array(0),
    usedItemRgb: false,
    partitionCandidates: [],
    resolvedPartitionField: 'name',
  }
}

// A two-leaf dendrogram positioned by the real layout, so SvgTreePath exercises
// the same path geometry as the on-screen tree.
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
  return clusterLayout(root, 100, 80)
}

function makeModel(overrides: Partial<RenderSvgModel> = {}): RenderSvgModel {
  // the sidebar reads `labelSources`, which is `sources` plus a derived label
  // tint — an override naming only one of them means both here
  const sources = overrides.sources ?? [{ name: 'a' }, { name: 'b' }]
  const model = {
    id: 'test',
    height: 100,
    error: undefined,
    regionTooLarge: false,
    svgReady: true,
    rpcDataMap: new Map([[0, makeRegionData()]]),
    renderState: {
      canvasWidth: 800,
      canvasHeight: 100,
      rowHeight: 50,
      rowProportion: 0.8,
      rowIndexByValue: new Map([
        ['a', 0],
        ['b', 1],
      ]),
      hiddenColors: new Set<number>(),
      rowColorsByIndex: [undefined, undefined],
    },
    sources,
    labelSources: sources,
    effectiveRowHeight: 50,
    treeAreaWidth: 80,
    showTree: false,
    hierarchy: undefined,
    showLegend: false,
    showRowSeparators: false,
    showRowLabels: true,
    colorLegend: [],
    rowGroupLegend: [],
    hiddenCategorySet: new Set<string>(),
    hasLegendEntries: false,
    ...overrides,
  }
  // Derived rather than defaulted, so a case naming either legend cannot leave
  // the gate behind disagreeing with it — the model derives it the same way.
  return {
    ...model,
    hasLegendEntries:
      model.colorLegend.length > 0 || model.rowGroupLegend.length > 0,
  }
}

function renderResult(result: React.ReactNode) {
  return renderToString(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg width={800} height={100} viewBox="0 0 800 100">
        {result as React.ReactElement}
      </svg>
    </ThemeProvider>,
  )
}

describe('LinearMultiRowFeatureDisplay renderSvg', () => {
  it('paints a feature block at its mapped screen position', async () => {
    const html = renderResult(await renderSvg(makeModel(), {}))
    // 1100..1200 over [1000,2000]→[0,800] is 0.8px/bp: x=80, width=80. Row 0 with
    // rowProportion 0.8 insets the 50px row to h=40 at top=(50-40)/2=5.
    expect(html).toContain('<rect x="80"')
    expect(html).toContain('width="80"')
  })

  it('draws the dendrogram in the reserved sidebar when the tree is shown', async () => {
    const html = renderResult(
      await renderSvg(
        makeModel({
          showTree: true,
          hierarchy: makeHierarchy(),
          treeAreaWidth: 40,
        }),
        {},
      ),
    )
    // SvgTreePath strokes the tree links in TREE_STROKE; the row labels shift
    // right past the reserved tree area.
    expect(html).toContain('stroke="#0008"')
    expect(html).toContain('translate(40 0)')
  })

  it('omits the dendrogram when the tree is hidden', async () => {
    const html = renderResult(await renderSvg(makeModel(), {}))
    expect(html).not.toContain('#0008')
  })

  it('draws a separator on each row boundary when showRowSeparators is set', async () => {
    const html = renderResult(
      await renderSvg(makeModel({ showRowSeparators: true }), {}),
    )
    // two 50px rows: one line, on the boundary between them, half-pixel offset
    // so the 1px stroke lands on a device pixel
    expect(html).toContain('y1="50.5"')
    expect(html.match(/<line /g)?.length).toBe(1)
  })

  // rowHeight is fractional whenever the display auto-fits, and the blocks
  // either side of a boundary already blend into the single pixel that boundary
  // falls in. The line has to cover that pixel: at 6.84 the boundaries are
  // 6.84 / 13.68 / 20.52, so pixels 6 / 13 / 20, where rounding would put the
  // last two at 14 and 21 -- a pixel below the color change they divide, which
  // leaves the blend showing as a stripe of the neighbouring row.
  it('puts each separator on the pixel its row boundary falls in', async () => {
    const html = renderResult(
      await renderSvg(
        makeModel({
          showRowSeparators: true,
          effectiveRowHeight: 6.84,
          sources: [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }],
        }),
        {},
      ),
    )
    expect(
      [...html.matchAll(/<line x1="0" y1="([\d.]+)"/g)].map(m => Number(m[1])),
    ).toEqual([6.5, 13.5, 20.5])
  })

  it('omits the row names when showRowLabels is off', async () => {
    const on = renderResult(await renderSvg(makeModel(), {}))
    expect(on).toContain('>a<')
    const off = renderResult(
      await renderSvg(makeModel({ showRowLabels: false }), {}),
    )
    expect(off).not.toContain('>a<')
    expect(off).not.toContain('>b<')
  })

  it('omits separators when rows are below the drawable threshold', async () => {
    const html = renderResult(
      await renderSvg(
        makeModel({ showRowSeparators: true, effectiveRowHeight: 2 }),
        {},
      ),
    )
    expect(html).not.toContain('<line ')
  })

  // The group stripe is the only thing carrying row identity once the rows are
  // too short to write their names, so the key naming its colors has to reach
  // the exported figure too — the frame is where this class of bug is visible
  // at all, a getter test can't see a legend that never got rendered.
  it('carries the row-group key into the export', async () => {
    const html = renderResult(
      await renderSvg(
        makeModel({
          showLegend: true,
          rowGroupLegend: [
            { color: '#e41a1c', label: 'Village dog' },
            { color: '#377eb8', label: 'Wolf' },
          ],
        }),
        {},
      ),
    )
    expect(html).toContain('>Village dog</text>')
    expect(html).toContain('>Wolf</text>')
    expect(html).toContain('fill="#e41a1c"')
    // a lone surviving section stays untitled, per legendEntries' shared rule
    expect(html).not.toContain('>Row groups</text>')
  })

  // With both vocabularies present each gets its heading, so a reader can tell
  // which axis a swatch is about.
  it('titles both sections when the feature key and the group key coexist', async () => {
    const html = renderResult(
      await renderSvg(
        makeModel({
          showLegend: true,
          colorLegend: [{ label: 'exon', color: 0xff0000ff }],
          rowGroupLegend: [
            { color: '#e41a1c', label: 'Village dog' },
            { color: '#377eb8', label: 'Wolf' },
          ],
        }),
        {},
      ),
    )
    expect(html).toContain('>Feature colors</text>')
    expect(html).toContain('>Row groups</text>')
  })

  // not "draws an error box instead of the body": an export is a standalone
  // figure, so a track whose data wouldn't load fails the whole export rather
  // than reserving its height for a message nobody downstream will read
  it('fails the export when model.error is set', async () => {
    await expect(
      renderSvg(makeModel({ error: new Error('boom') }), {}),
    ).rejects.toThrow('Cannot export: Error: boom')
  })
})
