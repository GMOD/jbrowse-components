import React from 'react'

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { renderToString } from 'react-dom/server'

import {
  makeFeatureData,
  makeFlatbushItem,
  packFixtureRects,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { renderSvg } from './renderSvg.tsx'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { RenderSvgModel } from './renderSvg.tsx'

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
    scrollTop: 0,
    error: undefined,
    regionTooLarge: false,
    svgReady: true,
    laidOutDataMap: new Map([[0, makeData([{ startBp: 1100, endBp: 1200 }])]]),
    highlightedFeatureIdSet: new Set<string>(),
    renderedShowLabels: true,
    renderedShowDescriptions: true,
    labelFontSize: 12,
    ...overrides,
  }
}

// renderSvg's body uses useTheme() for the highlight color, so render under the
// jbrowse theme the export runs in (a bare MUI theme lacks palette.highlight).
function renderResult(result: React.ReactNode) {
  return renderToString(
    <ThemeProvider theme={createJBrowseTheme()}>
      <svg width={800} height={100} viewBox="0 0 800 100">
        {result as React.ReactElement}
      </svg>
    </ThemeProvider>,
  )
}

describe('renderSvg', () => {
  // Universal SvgChrome: export always returns the chrome frame, even with no
  // data — the empty body renders no features but the wrapper is present.
  it('returns the chrome wrapper with no features when laidOutDataMap is empty', async () => {
    const result = await renderSvg(makeModel({ laidOutDataMap: new Map() }))
    expect(result).not.toBeNull()
    const html = renderResult(result)
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
    const html = renderResult(result)
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
    const html = renderResult(result)
    extractAndWriteSvg(html, 'with-features.svg')
    expect(html).toMatchSnapshot()
  })

  it('generates empty SVG when data is not in visible region', async () => {
    const result = await renderSvg(
      makeModel({ laidOutDataMap: new Map([[99, makeData()]]) }),
    )
    expect(result).not.toBeNull()
    const html = renderResult(result)
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
    const html = renderResult(result)
    extractAndWriteSvg(html, 'reversed.svg')
    expect(html).toMatchSnapshot()
  })

  it('bakes a highlight box (highlight.main tint + border) around a highlighted feature', async () => {
    const data = makeData([
      { startBp: 1100, endBp: 1200 },
      { startBp: 1400, endBp: 1600 },
    ])
    const result = await renderSvg(
      makeModel({
        laidOutDataMap: new Map([[0, data]]),
        highlightedFeatureIdSet: new Set(['f1']),
      }),
    )
    const html = renderResult(result)
    // highlight.main is #FFB11D; SvgCanvas splits the spaced rgba into rgb() +
    // *-opacity attrs (see paintAttr), so the box fill (0.25) and border (0.9)
    // land as separate opacity attributes
    expect(html).toContain('fill="rgb(255,177,29)" fill-opacity="0.25"')
    expect(html).toContain('stroke="rgb(255,177,29)"')
    expect(html).toContain('stroke-opacity="0.9"')
    // boxed around f1 (1400..1600 → 0.8px/bp → x 320..480), outset 2px: x=318
    expect(html).toContain('x="318"')
  })

  it('reserves the floating-label width so the highlight box wraps the label like on-screen', async () => {
    // f0 spans 1400..1600 → x 320..480 (160px wide) at this fixture's 0.8px/bp,
    // but its name label measures 500px wide. The on-screen searchHighlightBox
    // reserves the label width; the export must match, so the box extends past
    // the glyph to cover the label: width = 160 (glyph) + 340 (label overflow) +
    // 4 (2px outset each side) = 504, left = 320 - 2 = 318.
    const data = makeFeatureData({
      ...packFixtureRects([{ startBp: 1400, endBp: 1600 }]),
      flatbushItems: [
        makeFlatbushItem({ featureId: 'f0', startBp: 1400, endBp: 1600 }),
      ],
      floatingLabelsData: {
        f0: {
          featureId: 'f0',
          minX: 400,
          maxX: 600,
          topY: 0,
          featureHeight: 10,
          nameLabel: {
            text: 'a-very-long-gene-name',
            relativeY: 0,
            color: '#000',
            textWidth: 500,
          },
        },
      },
      featureCount: 1,
    })
    const result = await renderSvg(
      makeModel({
        laidOutDataMap: new Map([[0, data]]),
        highlightedFeatureIdSet: new Set(['f0']),
      }),
    )
    const html = renderResult(result)
    expect(html).toContain('x="318"')
    expect(html).toContain('width="504"')
  })

  it('emits no highlight box when the highlight set is empty', async () => {
    const data = makeData([{ startBp: 1100, endBp: 1200 }])
    const result = await renderSvg(
      makeModel({ laidOutDataMap: new Map([[0, data]]) }),
    )
    const html = renderResult(result)
    expect(html).not.toContain('rgb(255,177,29)')
  })

  // Runs last: renderSvg emits clip <g>s whose ids come from a module-global
  // counter in SvgCanvas, so extra renders here would renumber the snapshot
  // tests' clip ids above.
  it('offsets features and text by scrollTop so a scrolled track exports its viewport', async () => {
    const data = makeData([{ startBp: 1100, endBp: 1200 }])
    const render = renderResult
    const top = render(
      await renderSvg(
        makeModel({ laidOutDataMap: new Map([[0, data]]), scrollTop: 0 }),
      ),
    )
    const scrolled = render(
      await renderSvg(
        makeModel({ laidOutDataMap: new Map([[0, data]]), scrollTop: 30 }),
      ),
    )
    // At scrollTop=0 the feature rect sits at y=0; scrolled up by 30 it moves
    // to y=-30, proving the export honors the on-screen scroll offset instead
    // of always drawing the track top.
    expect(top).toContain('<rect x="80" y="0"')
    expect(scrolled).toContain('<rect x="80" y="-30"')
  })
})
