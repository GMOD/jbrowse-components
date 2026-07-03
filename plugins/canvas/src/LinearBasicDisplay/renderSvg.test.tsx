import React from 'react'

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { renderToString } from 'react-dom/server'

import { renderSvg } from './renderSvg.tsx'
import {
  makeFeatureData,
  makeFlatbushItem,
  packFixtureRects,
} from '../RenderFeatureDataRPC/testUtils.ts'

import type { RenderSvgModel } from './renderSvg.tsx'
import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'

// renderSvg calls getContainingView(model) to reach the LGV. Since the model
// is a plain object in tests (not an MST node), we intercept the call.
// LGV exposes totalWidthPx as a getter derived from dynamicBlocks; plain mock needs both
function makeDefaultMockView() {
  return {
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
    totalWidthPx: 800,
    dynamicBlocks: { totalWidthPx: 800 },
  }
}

let mockView = makeDefaultMockView()

jest.mock('@jbrowse/core/util', () => ({
  getContainingView: () => mockView,
}))

afterEach(() => {
  mockView = makeDefaultMockView()
})

function extractAndWriteSvg(html: string, filename: string) {
  const outputDir = path.join(__dirname, '__test-outputs__')
  mkdirSync(outputDir, { recursive: true })
  writeFileSync(path.join(outputDir, filename), html, 'utf-8')
}

jest.mock('mobx', () => ({
  ...jest.requireActual('mobx'),
  when: () => Promise.resolve(),
}))

function makeData(
  features: { startBp: number; endBp: number }[] = [],
): FeatureDataResult {
  return makeFeatureData({
    ...packFixtureRects(features),
    flatbushItems: features.map((f, i) =>
      makeFlatbushItem({
        featureId: `f${i}`,
        startBp: f.startBp,
        endBp: f.endBp,
      }),
    ),
    featureCount: features.length,
  })
}

function makeModel(overrides: Partial<RenderSvgModel> = {}): RenderSvgModel {
  return {
    id: 'test',
    height: 100,
    error: undefined,
    regionTooLarge: false,
    svgReady: true,
    laidOutDataMap: new Map([[0, makeData([{ startBp: 1100, endBp: 1200 }])]]),
    showLabels: true,
    effectiveShowDescriptions: true,
    ...overrides,
  }
}

describe('renderSvg', () => {
  // Universal SvgChrome: export always returns the chrome frame, even with no
  // data — the empty body renders no features but the wrapper is present.
  it('returns the chrome wrapper with no features when laidOutDataMap is empty', async () => {
    const result = await renderSvg(makeModel({ laidOutDataMap: new Map() }))
    expect(result).not.toBeNull()
    const html = renderToString(
      <svg width={800} height={100} viewBox="0 0 800 100">
        {result as React.ReactElement}
      </svg>,
    )
    extractAndWriteSvg(html, 'empty-map.svg')
    expect(html).toMatchSnapshot()
  })

  it('returns an error element when model.error is set', async () => {
    const result = await renderSvg(
      makeModel({
        laidOutDataMap: new Map(),
        error: new Error('fetch failed'),
      }),
    )
    expect(result).not.toBeNull()
    const html = renderToString(
      <svg width={800} height={100} viewBox="0 0 800 100">
        {result as React.ReactElement}
      </svg>,
    )
    extractAndWriteSvg(html, 'error.svg')
    expect(html).toMatchSnapshot()
  })

  it('generates SVG with features in visible region', async () => {
    const data = makeData([
      { startBp: 1100, endBp: 1200 },
      { startBp: 1400, endBp: 1600 },
    ])
    const result = await renderSvg(
      makeModel({ laidOutDataMap: new Map([[0, data]]) }),
    )
    expect(result).not.toBeNull()
    const html = renderToString(
      <svg width={800} height={100} viewBox="0 0 800 100">
        {result as React.ReactElement}
      </svg>,
    )
    extractAndWriteSvg(html, 'with-features.svg')
    expect(html).toMatchSnapshot()
  })

  it('generates empty SVG when data is not in visible region', async () => {
    const result = await renderSvg(
      makeModel({ laidOutDataMap: new Map([[99, makeData()]]) }),
    )
    expect(result).not.toBeNull()
    const html = renderToString(
      <svg width={800} height={100} viewBox="0 0 800 100">
        {result as React.ReactElement}
      </svg>,
    )
    extractAndWriteSvg(html, 'empty.svg')
    expect(html).toMatchSnapshot()
  })

  it('generates SVG with reversed region', async () => {
    mockView = {
      visibleRegions: [
        {
          displayedRegionIndex: 0,
          start: 1000,
          end: 2000,
          reversed: true,
          screenStartPx: 0,
          screenEndPx: 800,
        },
      ],
      bpPerPx: 1,
      width: 800,
      totalWidthPx: 800,
      dynamicBlocks: { totalWidthPx: 800 },
    }

    const data = makeData([
      { startBp: 1100, endBp: 1200 },
      { startBp: 1400, endBp: 1600 },
    ])
    const result = await renderSvg(
      makeModel({ laidOutDataMap: new Map([[0, data]]) }),
    )
    expect(result).not.toBeNull()
    const html = renderToString(
      <svg width={800} height={100} viewBox="0 0 800 100">
        {result as React.ReactElement}
      </svg>,
    )
    extractAndWriteSvg(html, 'reversed.svg')
    expect(html).toMatchSnapshot()
  })
})
