import { jest } from '@jest/globals'

import { renderSvg } from './renderSvg.tsx'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { RenderSvgModel } from './renderSvg.ts'

// renderSvg calls getContainingView(model) to reach the LGV. Since the model
// is a plain object in tests (not an MST node), we intercept the call.
const mockView = {
  visibleRegions: [
    {
      displayedRegionIndex: 0,
      start: 1000,
      end: 2000,
      reversed: false,
      screenStartPx: 0,
      screenEndPx: 800,
    },
  ],
  bpPerPx: 1,
  width: 800,
}

jest.mock('@jbrowse/core/util', async () => {
  const actual = await jest.importActual<typeof import('@jbrowse/core/util')>(
    '@jbrowse/core/util',
  )
  return {
    ...actual,
    getContainingView: () => mockView,
  }
})

function makeData(
  features: { startBp: number; endBp: number }[] = [],
): FeatureDataResult {
  const n = features.length
  return {
    regionStart: 0,
    rectPositions: new Uint32Array(features.flatMap(f => [f.startBp, f.endBp])),
    rectYs: new Float32Array(n),
    rectHeights: new Float32Array(n).fill(10),
    rectColors: new Uint32Array(n).fill(0xff_80_40_ff),
    rectFeatureIndices: new Uint32Array(features.map((_, i) => i)),
    outlineColor: 0,
    linePositions: new Uint32Array(0),
    lineYs: new Float32Array(0),
    lineColors: new Uint32Array(0),
    lineDirections: new Int8Array(0),
    lineFeatureIndices: new Uint32Array(0),
    arrowXs: new Uint32Array(0),
    arrowYs: new Float32Array(0),
    arrowDirections: new Int8Array(0),
    arrowColors: new Uint32Array(0),
    arrowFeatureIndices: new Uint32Array(0),
    flatbushItems: features.map((f, i) => ({
      kind: 'feature' as const,
      featureId: `f${i}`,
      type: 'gene',
      startBp: f.startBp,
      endBp: f.endBp,
      topPx: 0,
      bottomPx: 10,
      featureHeightPx: 10,
      tooltip: `f${i}`,
    })),
    subfeatureInfos: [],
    floatingLabelsData: {},
    featureCount: n,
  }
}

function makeModel(overrides: Partial<RenderSvgModel> = {}): RenderSvgModel {
  return {
    id: 'test',
    height: 100,
    error: undefined,
    regionTooLarge: false,
    laidOutDataMap: new Map([[0, makeData([{ startBp: 1100, endBp: 1200 }])]]),
    ...overrides,
  }
}

describe('renderSvg', () => {
  it('returns null when laidOutDataMap is empty', async () => {
    const result = await renderSvg(
      makeModel({ laidOutDataMap: new Map() }),
    )
    expect(result).toBeNull()
  })

  it('returns an error element when model.error is set', async () => {
    const result = await renderSvg(
      makeModel({ laidOutDataMap: new Map(), error: new Error('fetch failed') }),
    )
    expect(result).not.toBeNull()
    // SVGErrorBox renders as a React element
    const element = result as React.ReactElement
    expect(element.props).toBeDefined()
  })

  it('returns SVG content when there is feature data', async () => {
    const result = await renderSvg(makeModel())
    expect(result).not.toBeNull()
    const element = result as React.ReactElement
    // SvgClipRect wraps the output
    expect(element.type).toBeDefined()
    expect(element.props.width).toBe(800)
    expect(element.props.height).toBe(100)
  })

  it('renders rects for features in visible region', async () => {
    const data = makeData([
      { startBp: 1100, endBp: 1200 },
      { startBp: 1400, endBp: 1600 },
    ])
    const result = await renderSvg(
      makeModel({ laidOutDataMap: new Map([[0, data]]) }),
    )
    const element = result as React.ReactElement
    const svg: string = element.props.children.props.dangerouslySetInnerHTML.__html
    expect(svg).toContain('<rect')
  })

  it('skips regions not in laidOutDataMap', async () => {
    // displayedRegionIndex=99 has no data, so output should be empty SVG
    const result = await renderSvg(
      makeModel({ laidOutDataMap: new Map([[99, makeData()]]) }),
    )
    const element = result as React.ReactElement
    const svg: string = element.props.children.props.dangerouslySetInnerHTML.__html
    expect(svg).not.toContain('<rect')
  })
})
