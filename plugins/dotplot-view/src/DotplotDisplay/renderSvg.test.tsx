import { renderToStaticMarkup } from 'react-dom/server'

import { renderSvg } from './renderSvg.tsx'

import type {
  DotplotGeometryData,
  DotplotRenderState,
} from './dotplotRenderingBackendTypes.ts'
import type { DotplotRenderModel } from './types.ts'

// renderSvg reads the containing view for the plot size and render state, and
// awaits svgReady through mobx `when`. The model is a plain object here, so
// both are intercepted (same shape as the canvas display's renderSvg test).
// `dotplotRenderState` is annotated rather than inferred so a field added to the
// real getter fails to compile here instead of reaching the draw call as
// undefined — `alpha` did, and every stroke came out `rgba(r,g,b,NaN)`.
const view: {
  viewWidth: number
  viewHeight: number
  dotplotRenderState: DotplotRenderState
} = {
  viewWidth: 100,
  viewHeight: 100,
  dotplotRenderState: {
    // identity mapping: screen x = x1, screen y = viewHeight - y1
    viewBpH: 0,
    viewBpV: 0,
    bpPerPxHInv: 1,
    bpPerPxVInv: 1,
    lineWidth: 2,
    alpha: 1,
    displayKeys: [0],
  },
}

jest.mock('@jbrowse/core/util', () => ({
  getContainingView: () => view,
}))

jest.mock('mobx', () => ({
  ...jest.requireActual('mobx'),
  when: () => Promise.resolve(),
}))

function geometry(
  segments: [number, number, number, number][],
): DotplotGeometryData {
  return {
    x1: new Float64Array(segments.map(s => s[0])),
    y1: new Float64Array(segments.map(s => s[1])),
    x2: new Float64Array(segments.map(s => s[2])),
    y2: new Float64Array(segments.map(s => s[3])),
    colors: new Uint32Array(segments.map(() => 0xff_00_00_ff)),
    instanceFeatureIdx: new Uint32Array(segments.map((_s, i) => i)),
    instanceCount: segments.length,
    baseH: 0,
    baseV: 0,
  }
}

function model(overrides: Partial<DotplotRenderModel> = {}) {
  return {
    geometry: undefined,
    svgReady: true,
    ...overrides,
  }
}

function drawnSegments(html: string) {
  const d = /<path d="([^"]*)"/.exec(html)
  return d
    ? [...d[1]!.matchAll(/M([\d.-]+),([\d.-]+)L([\d.-]+),([\d.-]+)/g)].map(m =>
        m.slice(1).map(Number),
      )
    : []
}

// The error terminal state is the view's (SVGDotplotView owns it, since every
// display paints the same plot rect), so an errored display draws whatever
// geometry it still holds — the on-screen behavior, where a failed refetch
// leaves the old dots under the ErrorBanner.
test('a display with no geometry yet exports the empty plot', async () => {
  const html = renderToStaticMarkup(await renderSvg(model()))
  expect(html).not.toContain('fill="#ffdddd"')
  expect(drawnSegments(html)).toEqual([])
})

test('segments outside the plot are dropped, not left for the clip', async () => {
  const html = renderToStaticMarkup(
    await renderSvg(
      model({
        geometry: geometry([
          [10, 90, 20, 80], // inside
          [500, 90, 510, 80], // off the right edge
          [10, -500, 20, -490], // below the bottom edge
          [30, 70, 40, 60], // inside
        ]),
      }),
    ),
  )
  expect(drawnSegments(html)).toEqual([
    [10, 10, 20, 20],
    [30, 30, 40, 40],
  ])
})

test('a segment straddling an edge is kept whole', async () => {
  const html = renderToStaticMarkup(
    await renderSvg(model({ geometry: geometry([[90, 90, 140, 40]]) })),
  )
  expect(drawnSegments(html)).toEqual([[90, 10, 140, 60]])
})
