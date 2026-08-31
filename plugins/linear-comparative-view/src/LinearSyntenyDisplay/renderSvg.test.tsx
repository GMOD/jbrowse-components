import { renderToString } from 'react-dom/server'

import { renderSvg } from './renderSvg.tsx'

import type { SyntenyInstanceData } from '../LinearSyntenyRPC/buildSyntenyGeometry.ts'
import type { SyntenySvgModel } from './renderSvg.tsx'
import type { SyntenyTrackRenderParams } from './syntenyRenderingBackendTypes.ts'

// One instance, corners given in window-relative bp (base0/base1 = 0 and
// bpPerPx = 1, so these read directly as screen px).
function makeData(
  corners: [number, number, number, number],
): SyntenyInstanceData {
  const [bp1, bp2, bp3, bp4] = corners
  return {
    bp1: Float32Array.from([bp1]),
    bp2: Float32Array.from([bp2]),
    bp3: Float32Array.from([bp3]),
    bp4: Float32Array.from([bp4]),
    base0: 0,
    base1: 0,
    colors: new Uint32Array([0xff0000ff]),
    kinds: new Uint8Array(1),
    instanceFeatureIdx: new Uint32Array(1),
    alignmentLengths: Float32Array.from([10000]),
    instanceCount: 1,
  }
}

const params: SyntenyTrackRenderParams = {
  yTop: 0,
  height: 100,
  alpha: 1,
  fadeThinAlignments: true,
  minAlignmentLength: 0,
  hoveredFeatureId: 0,
  clickedFeatureId: 0,
  offsetPx0: 0,
  offsetPx1: 0,
  bpPerPx0: 1,
  bpPerPx1: 1,
  drawCurves: false,
}

function makeModel(
  data: SyntenyInstanceData | undefined,
  overrides?: Partial<SyntenySvgModel>,
): SyntenySvgModel {
  return {
    svgReady: true,
    error: undefined,
    height: 100,
    renderInstanceData: data,
    renderParams: data ? params : undefined,
    // overdrawPx matches the view default, so the per-edge cull is as permissive
    // here as it is in a real export
    view: { width: 800, overdrawPx: 1000 },
    groundColor: '#fff',
    ...overrides,
  }
}

// A stub for the rasterize branch, so it can be exercised without a DOM canvas.
// createSvgRasterCanvas takes the factory from opts, which is the same seam
// jbrowse-img uses to pass node-canvas.
function makeStubCanvas() {
  const ops: string[] = []
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'toDataURL') {
          return undefined
        }
        return (...args: unknown[]) => {
          ops.push(`${String(prop)}(${args.join(',')})`)
        }
      },
      set: () => true,
    },
  )
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toDataURL: () => 'data:image/png;base64,STUB',
  } as unknown as HTMLCanvasElement
  return { canvas, ops }
}

test('draws a visible ribbon as vector paths', async () => {
  const html = renderToString(
    await renderSvg(makeModel(makeData([10, 100, 110, 20]))),
  )
  expect(html).toContain('<path')
  expect(html).toContain('rgb(255,0,0)')
})

test('emits nothing for a ribbon entirely off-canvas', async () => {
  // 900px left of the viewport: inside overdrawPx=1000 so the per-edge cull
  // keeps it, but every corner is off-canvas so it can never be visible. The
  // export used to serialize these — the level's clipPath then threw them away.
  const html = renderToString(
    await renderSvg(makeModel(makeData([-950, -900, -880, -930]))),
  )
  expect(html).not.toContain('<path')
})

test('renders nothing at all before data resolves', async () => {
  expect(renderToString(await renderSvg(makeModel(undefined)))).toBe('')
})

test('rasterizeLayers embeds a PNG instead of paths', async () => {
  const { canvas, ops } = makeStubCanvas()
  const html = renderToString(
    await renderSvg(makeModel(makeData([10, 100, 110, 20])), {
      rasterizeLayers: true,
      createCanvas: () => canvas,
    }),
  )
  expect(html).toContain('data:image/png;base64,STUB')
  expect(html).not.toContain('<path')
  // 2x raster scale is pre-applied by createSvgRasterCanvas, so the paint
  // callback still draws in logical coords
  expect(ops).toContain('scale(2,2)')
  expect(ops.filter(op => op === 'fill()')).toHaveLength(1)
})
