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

// The barrel is stubbed rather than spread from the real one — requiring it here
// pulls in tracks.ts and the whole config layer. `measureText` is stubbed with a
// proportional approximation because SvgColorLegend really does call it (it sizes
// the color key from its label widths); these tests assert on the key's labels and
// swatch colors, not on its measured width.
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
    // a real normal-mode size (labelFontSize('normal')), not an arbitrary number:
    // label widths are baked at LABEL_FONT_SIZE and scaled to the drawn size, so
    // the fixture has to name a size the display actually resolves to
    labelFontSize: LABEL_FONT_SIZE,
    colorLegend: [],
    showLegend: true,
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

  // A track whose fetch failed used to export a red box with the message in it.
  // It fails the export instead: a figure is a standalone artifact, so there is
  // no reader downstream to notice the box and no way to tell it apart from a
  // track that legitimately drew nothing.
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
    // Same fixture as above, exported in superCompact (labelFontSize 7.7). The
    // baked 500px width was measured at LABEL_FONT_SIZE, so the label paints at
    // 500 × 7.7/11 = 350px and the box must reserve that, not the full 500:
    // width = 160 (glyph) + 190 (overflow) + 4 (outset) = 354. Reserving 504 here
    // drew a box half again wider than the text it was boxing.
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

  // The color key a display contributes through the `colorLegend` hook (variants'
  // consequence-impact / SV-type presets) has to reach the export too — an
  // exported figure of colored glyphs is unreadable without it. A plain feature
  // track answers `undefined` and draws none, and a key the user has put away on
  // screen stays away, so the export matches what they were looking at.
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

  // Runs last: renderSvg emits clip <g>s whose ids come from a module-global
  // counter in SvgCanvas, so extra renders here would renumber the snapshot
  // tests' clip ids above.
  it('offsets features and text by scrollTop so a scrolled track exports its viewport', async () => {
    const data = makeData([{ startBp: 1100, endBp: 1200 }])
    const render = renderResult
    const at = async (scrollTop: number) =>
      render(
        await renderSvg(
          makeModel({ laidOutDataMap: new Map([[0, data]]), scrollTop }),
        ),
      )
    // The fixture's rect occupies track y 0..10. At scrollTop=0 it sits at
    // y=0; scrolled up by 5 it moves to y=-5, proving the export honors the
    // on-screen scroll offset instead of always drawing the track top.
    expect(await at(0)).toContain('<rect x="80" y="0"')
    expect(await at(5)).toContain('<rect x="80" y="-5"')
    // Scrolled past it entirely, it is not emitted at all: it would land 20px above
    // the viewport, inside the block scissor's clip and therefore invisible.
    // The export used to serialize every such rect anyway (see rowVisible in
    // Canvas2DFeatureRenderer), which on a track scrolling over thousands of px
    // of rows is most of the file.
    expect(await at(30)).not.toContain('<rect x="80"')
  })

  // The DOM overlay positions a label div by its TOP at labelY with
  // line-height 1; canvas fillText takes the baseline, so the export converts
  // through LABEL_BASELINE_RATIO. Drawing at labelY + fontSize (the box bottom)
  // instead put every exported label ~1.8px below where the screen shows it.
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
    // labelY = featureBottom(10) + relativeY(0) + LABEL_TOP_GAP_PX(2) = 12,
    // baseline = round(12 + 11 * 0.84) = 21
    expect(html).toContain('y="21"')
    expect(html).toContain('GENE1')
  })

  // The badge is an affordance on screen and a caption in an export. "+3 more"
  // survives the change of medium — it says what the picture leaves out — while
  // its expanded form says "show fewer", which addresses a control the file does
  // not carry, over a gene the export has already drawn in full.
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

  // A feature ending exactly at the region start is the normal shape at a
  // displayed-region boundary: it is drawn entirely in the previous region and
  // contributes no pixels here. The on-screen overlay drops it (overlayItemRect
  // returns undefined); the export used to box it anyway, and the box's
  // reserved label width then painted a wide phantom stripe at this region's
  // left edge — inside the block scissor, so nothing clipped it away.
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

  // The export clips to the display's own height, so a label on a feature far
  // down a tall track's content is written into the file and then clipped away.
  // It shares the DOM overlay's cull band (labelCullBand) so it emits the same
  // labels the user is looking at; without it a fixed-height track over a few
  // thousand px of content exported an order of magnitude more <text> nodes
  // than it showed.
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
        // 5000px down a track exported 100px tall: outside the band on every
        // scrollTop this test uses
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

    // ...and the band follows scrollTop rather than being pinned to the track
    // top, so scrolling down to the far feature exports it and drops the near
    // one.
    const scrolled = renderResult(
      await renderSvg(
        makeModel({ laidOutDataMap: new Map([[0, data]]), scrollTop: 5000 }),
      ),
    )
    expect(scrolled).toContain('OFF-VIEWPORT')
    expect(scrolled).not.toContain('IN-VIEWPORT')
  })
})
