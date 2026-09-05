import React from 'react'

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material'
import { renderToString } from 'react-dom/server'

import { LABEL_FONT_SIZE } from '../RenderFeatureDataRPC/constants.ts'
import {
  labelsMap,
  makeFeatureData,
  makeFlatbushItem,
  packFixtureRects,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { renderSvg } from './renderSvg.tsx'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { RenderSvgModel } from './renderSvg.tsx'

// The model is a plain object here, not an MST node, so `getContainingView`
// is intercepted.
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

// The barrel is stubbed rather than spread from the real one, which pulls in
// tracks.ts and the whole config layer; `measureText` is stubbed because
// SvgColorLegend calls it.
jest.mock('@jbrowse/core/util', () => ({
  getContainingView: () => mockView,
  measureText: (str: unknown, fontSize = 10) =>
    String(str).length * fontSize * 0.6,
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
    drawsWhenTooLarge: false,
    densityBandActive: false,
    densityBandLayer: { regions: new Map(), maxDepth: 0 },
    densityPeakReadout: '',
    svgReady: true,
    laidOutDataMap: new Map([[0, makeData([{ startBp: 1100, endBp: 1200 }])]]),
    highlightedFeatureIdSet: new Set<string>(),
    renderedShowLabels: true,
    renderedShowSubfeatureLabels: true,
    renderedShowDescriptions: true,
    labelFontSize: LABEL_FONT_SIZE,
    colorLegend: [],
    showLegend: true,
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

describe('renderSvg', () => {
  it('returns the chrome wrapper with no features when laidOutDataMap is empty', async () => {
    const result = await renderSvg(makeModel({ laidOutDataMap: new Map() }))
    expect(result).not.toBeNull()
    const html = renderResult(result)
    extractAndWriteSvg(html, 'empty-map.svg')
    expect(html).toMatchSnapshot()
  })

  it('rejects when model.error is set, rather than drawing the error', async () => {
    await expect(
      renderSvg(
        makeModel({
          laidOutDataMap: new Map(),
          error: new Error('fetch failed'),
        }),
      ),
    ).rejects.toThrow('Cannot export: Error: fetch failed')
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
    expect(html).toContain('fill="rgb(255,177,29)" fill-opacity="0.25"')
    expect(html).toContain('stroke="rgb(255,177,29)"')
    expect(html).toContain('stroke-opacity="0.9"')
    expect(html).toContain('x="318"')
  })

  it('reserves the floating-label width so the highlight box wraps the label like on-screen', async () => {
    const data = makeFeatureData({
      ...packFixtureRects([{ startBp: 1400, endBp: 1600 }]),
      flatbushItems: [
        makeFlatbushItem({ featureId: 'f0', startBp: 1400, endBp: 1600 }),
      ],
      floatingLabelsData: labelsMap({
        f0: {
          featureId: 'f0',
          minX: 400,
          maxX: 600,
          topY: 0,
          featureHeight: 10,
          nameLabel: {
            text: 'a-very-long-gene-name',
            relativeY: 0,
            textWidth: 500,
          },
        },
      }),
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

  it('scales the reserved label width to a compact mode font size', async () => {
    const data = makeFeatureData({
      ...packFixtureRects([{ startBp: 1400, endBp: 1600 }]),
      flatbushItems: [
        makeFlatbushItem({ featureId: 'f0', startBp: 1400, endBp: 1600 }),
      ],
      floatingLabelsData: labelsMap({
        f0: {
          featureId: 'f0',
          minX: 400,
          maxX: 600,
          topY: 0,
          featureHeight: 10,
          nameLabel: {
            text: 'a-very-long-gene-name',
            relativeY: 0,
            textWidth: 500,
          },
        },
      }),
      featureCount: 1,
    })
    const result = await renderSvg(
      makeModel({
        laidOutDataMap: new Map([[0, data]]),
        highlightedFeatureIdSet: new Set(['f0']),
        labelFontSize: LABEL_FONT_SIZE * 0.7,
      }),
    )
    const html = renderResult(result)
    expect(html).toContain('x="318"')
    expect(html).toContain('width="354"')
  })

  it('emits no highlight box when the highlight set is empty', async () => {
    const data = makeData([{ startBp: 1100, endBp: 1200 }])
    const result = await renderSvg(
      makeModel({ laidOutDataMap: new Map([[0, data]]) }),
    )
    const html = renderResult(result)
    expect(html).not.toContain('rgb(255,177,29)')
  })

  it('bakes the display color key into the export, and omits it when absent or dismissed', async () => {
    const data = makeData([{ startBp: 1100, endBp: 1200 }])
    const exportWith = async (showLegend: boolean) =>
      renderResult(
        await renderSvg(
          makeModel({
            laidOutDataMap: new Map([[0, data]]),
            showLegend,
            colorLegend: [
              { label: 'HIGH', color: '#d32f2f' },
              { label: 'LOW', color: '#fbc02d' },
            ],
          }),
        ),
      )
    const withKey = await exportWith(true)
    expect(withKey).toContain('HIGH')
    expect(withKey).toContain('#d32f2f')

    expect(await exportWith(false)).not.toContain('HIGH')

    const withoutKey = renderResult(
      await renderSvg(makeModel({ laidOutDataMap: new Map([[0, data]]) })),
    )
    expect(withoutKey).not.toContain('HIGH')
  })

  // Runs last: SvgCanvas numbers clip ids from a module-global counter, so
  // extra renders here would renumber the snapshot tests' ids.
  it('offsets features and text by scrollTop so a scrolled track exports its viewport', async () => {
    const data = makeData([{ startBp: 1100, endBp: 1200 }])
    const render = renderResult
    const at = async (scrollTop: number) =>
      render(
        await renderSvg(
          makeModel({ laidOutDataMap: new Map([[0, data]]), scrollTop }),
        ),
      )
    expect(await at(0)).toContain('<rect x="80" y="0"')
    expect(await at(5)).toContain('<rect x="80" y="-5"')
    expect(await at(30)).not.toContain('<rect x="80"')
  })

  it('places label text on the same baseline the DOM overlay uses', async () => {
    const data = makeFeatureData({
      ...packFixtureRects([{ startBp: 1400, endBp: 1600 }]),
      flatbushItems: [
        makeFlatbushItem({ featureId: 'f0', startBp: 1400, endBp: 1600 }),
      ],
      floatingLabelsData: labelsMap({
        f0: {
          featureId: 'f0',
          minX: 1400,
          maxX: 1600,
          topY: 0,
          featureHeight: 10,
          nameLabel: {
            text: 'GENE1',
            relativeY: 0,
            textWidth: 40,
          },
        },
      }),
      featureCount: 1,
    })
    const html = renderResult(
      await renderSvg(makeModel({ laidOutDataMap: new Map([[0, data]]) })),
    )
    expect(html).toContain('y="21"')
    expect(html).toContain('GENE1')
  })

  it('exports the collapsed badge and drops the expanded one', async () => {
    const withBadge = async (expanded: boolean) => {
      const data = makeFeatureData({
        ...packFixtureRects([{ startBp: 1400, endBp: 1600 }]),
        flatbushItems: [
          makeFlatbushItem({ featureId: 'f0', startBp: 1400, endBp: 1600 }),
        ],
        floatingLabelsData: labelsMap({
          f0: {
            featureId: 'f0',
            minX: 1400,
            maxX: 1600,
            topY: 0,
            featureHeight: 10,
            nameLabel: {
              text: 'GENE1',
              relativeY: 0,
              textWidth: 40,
            },
            moreIsoformsLabel: {
              text: expanded ? 'show fewer' : '+3 more',
              relativeY: 0,
              textWidth: 30,
              hidden: 3,
              expanded,
            },
          },
        }),
        featureCount: 1,
      })
      return renderResult(
        await renderSvg(makeModel({ laidOutDataMap: new Map([[0, data]]) })),
      )
    }
    const collapsed = await withBadge(false)
    expect(collapsed).toContain('GENE1')
    expect(collapsed).toContain('+3 more')
    const expanded = await withBadge(true)
    expect(expanded).toContain('GENE1')
    expect(expanded).not.toContain('show fewer')
  })

  it('draws no highlight box for a feature that only touches the region edge', async () => {
    const data = makeFeatureData({
      ...packFixtureRects([{ startBp: 800, endBp: 1000 }]),
      flatbushItems: [
        makeFlatbushItem({ featureId: 'f0', startBp: 800, endBp: 1000 }),
      ],
      floatingLabelsData: labelsMap({
        f0: {
          featureId: 'f0',
          minX: 800,
          maxX: 1000,
          topY: 0,
          featureHeight: 10,
          nameLabel: {
            text: 'a-very-long-gene-name',
            relativeY: 0,
            textWidth: 500,
          },
        },
      }),
      featureCount: 1,
    })
    const html = renderResult(
      await renderSvg(
        makeModel({
          laidOutDataMap: new Map([[0, data]]),
          highlightedFeatureIdSet: new Set(['f0']),
        }),
      ),
    )
    expect(html).not.toContain('rgb(255,177,29)')
  })

  it('omits labels whose feature is scrolled far outside the exported viewport', async () => {
    const label = (text: string) => ({
      text,
      relativeY: 0,
      textWidth: 40,
    })
    const data = makeFeatureData({
      ...packFixtureRects([{ startBp: 1400, endBp: 1600 }]),
      flatbushItems: [
        makeFlatbushItem({ featureId: 'near', startBp: 1400, endBp: 1600 }),
        makeFlatbushItem({ featureId: 'far', startBp: 1400, endBp: 1600 }),
      ],
      floatingLabelsData: labelsMap({
        near: {
          featureId: 'near',
          minX: 1400,
          maxX: 1600,
          topY: 0,
          featureHeight: 10,
          nameLabel: label('IN-VIEWPORT'),
        },
        far: {
          featureId: 'far',
          minX: 1400,
          maxX: 1600,
          topY: 5000,
          featureHeight: 10,
          nameLabel: label('OFF-VIEWPORT'),
        },
      }),
      featureCount: 2,
    })
    const html = renderResult(
      await renderSvg(makeModel({ laidOutDataMap: new Map([[0, data]]) })),
    )
    expect(html).toContain('IN-VIEWPORT')
    expect(html).not.toContain('OFF-VIEWPORT')

    const scrolled = renderResult(
      await renderSvg(
        makeModel({ laidOutDataMap: new Map([[0, data]]), scrollTop: 5000 }),
      ),
    )
    expect(scrolled).toContain('OFF-VIEWPORT')
    expect(scrolled).not.toContain('IN-VIEWPORT')
  })
})
