import React from 'react'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { clusterLayout } from '@jbrowse/tree-sidebar'
import { ThemeProvider } from '@mui/material'
import { renderToString } from 'react-dom/server'

import { renderSvg } from './renderSvg.tsx'

import type { RenderSvgModel } from './renderSvg.tsx'
import type { MultiRowGetFeaturesResult } from '../MultiRowGetFeaturesRPC/rpcTypes.ts'
import type {
  ClusterHierarchyNode,
  HierarchyNode,
  NewickNode,
} from '@jbrowse/tree-sidebar'

// renderSvg calls getContainingView(self) to reach the LGV; the model is a plain
// object in these tests, so intercept it. awaitSvgReady awaits mobx `when`, so
// resolve that immediately.
const mockView = { width: 800 }
// Stub only what renderSvg + SvgRowLabels reach for; requireActual pulls in the
// whole core/util barrel and trips a jest module-init cycle.
jest.mock('@jbrowse/core/util', () => ({
  getContainingView: () => mockView,
  measureText: (s: string, fontSize = 10) => s.length * fontSize * 0.6,
  max: (arr: number[], d = 0) => (arr.length ? Math.max(...arr) : d),
  getFillProps: (color: string) => ({ fill: color }),
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
  return {
    id: 'test',
    height: 100,
    error: undefined,
    regionTooLarge: false,
    svgReady: true,
    rpcDataMap: new Map([[0, makeRegionData()]]),
    renderBlocks: [
      {
        displayedRegionIndex: 0,
        start: 1000,
        end: 2000,
        screenStartPx: 0,
        screenEndPx: 800,
        reversed: false,
      },
    ],
    renderState: {
      canvasWidth: 800,
      canvasHeight: 100,
      rowHeight: 50,
      rowProportion: 0.8,
      rowIndexByValue: new Map([
        ['a', 0],
        ['b', 1],
      ]),
      rowColorsByIndex: [undefined, undefined],
    },
    sources: [{ name: 'a' }, { name: 'b' }],
    rowHeight: 50,
    treeAreaWidth: 80,
    showTree: false,
    hierarchy: undefined,
    ...overrides,
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

  it('renders the error box instead of the body when model.error is set', async () => {
    const html = renderResult(
      await renderSvg(makeModel({ error: new Error('boom') }), {}),
    )
    expect(html).toContain('boom')
    expect(html).not.toContain('<rect x="80"')
  })
})
