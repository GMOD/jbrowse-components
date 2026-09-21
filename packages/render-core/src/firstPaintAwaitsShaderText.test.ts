import { types } from '@jbrowse/mobx-state-tree'
import { act, renderHook } from '@testing-library/react'

import { RenderLifecycleMixin } from './RenderLifecycleMixin.ts'
import { setGpuOverride } from './gpuDevice.ts'
import { installUpload } from './installUpload.ts'
import { createMarkBackend } from './marks/markBackend.ts'
import { spanMark } from './marks/spanMark.ts'
import { defineMark } from './marks/types.ts'
import { useRenderingBackend } from './useRenderingBackend.ts'

import type { ShaderSource } from './hal/types.ts'
import type { SpanChannels, SpanParams } from './marks/spanMark.ts'
import type { PerRegionRenderingBackend } from './perRegionRenderingBackend.ts'

// A display's shader text arrives while its data is already waiting, which is
// the order a first open takes whenever the fetch wins: the canvas mounts, the
// HAL waits on the text, and nothing may paint until it lands. What a user sees
// is the display's loading state held until the first real frame, so the
// assertion is on the frame count as well as on `canvasDrawn`: one frame, not a
// blank one ahead of it.

interface State {
  canvasWidth: number
  canvasHeight: number
  span: SpanParams
}

const STATE: State = {
  canvasWidth: 300,
  canvasHeight: 80,
  span: {
    rowHeight: 10,
    rowProportion: 1,
    minWidthPx: 0,
    seamPx: 0,
    scrollTop: 0,
  },
}

const BLOCKS = [
  {
    displayedRegionIndex: 0,
    start: 0,
    end: 100,
    screenStartPx: 0,
    screenEndPx: 300,
    reversed: false,
  },
]

const REGION: SpanChannels = {
  x: Uint32Array.of(10),
  x2: Uint32Array.of(90),
  row: Uint32Array.of(0),
  color: Uint32Array.of(0xff0000ff),
  count: 1,
}

type Backend = PerRegionRenderingBackend<SpanChannels, State>

const Display = types
  .compose('Display', RenderLifecycleMixin(), types.model({}))
  .actions(self => ({
    startRenderingBackend(backend: Backend) {
      installUpload(self, backend, {
        cells: () => new Map([[0, REGION]]),
        render: (b, regions) => b.renderBlocks(BLOCKS, regions, STATE),
      })
    },
  }))

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  let reject: (reason: unknown) => void = () => {}
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

// Contexts that accept every call, counting instanced draws on the GL one and
// fills on the 2D one, and a canvas recording which kinds were asked for.
function fakeCanvas() {
  const log = { contexts: [] as string[], glDraws: 0, fills: 0 }
  const permissive = (target: Record<string, unknown>) =>
    new Proxy(target, {
      get: (t, name: string) => (name in t ? t[name] : () => ({})),
      set: () => true,
    })
  const gl = permissive({
    INVALID_INDEX: 0xffffffff,
    NO_ERROR: 0,
    getParameter: () => 8192,
    getError: () => 0,
    isContextLost: () => false,
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    getUniformBlockIndex: () => 0,
    getAttribLocation: () => 0,
    drawArraysInstanced: () => {
      log.glDraws++
    },
  })
  const ctx2d = permissive({
    fillRect: () => {
      log.fills++
    },
  })
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: (kind: string) => {
      log.contexts.push(kind)
      return kind === 'webgl2' ? gl : kind === '2d' ? ctx2d : null
    },
  }
  return { canvas: canvas as unknown as HTMLCanvasElement, log }
}

function mountWithGlsl(glsl: ShaderSource['glsl']) {
  const mark = defineMark({
    shape: {
      ...spanMark,
      pass: { ...spanMark.pass, source: { ...spanMark.pass.source, glsl } },
    },
    channels: (r: SpanChannels) => r,
    params: (s: State) => s.span,
  })
  const model = Display.create()
  const factory = (c: HTMLCanvasElement) => createMarkBackend(c, [mark])
  const { result } = renderHook(() => useRenderingBackend(factory, model))
  const { canvas, log } = fakeCanvas()
  act(() => {
    result.current.canvasRef(canvas)
  })
  return { model, log }
}

beforeEach(() => {
  setGpuOverride('webgl')
})

afterEach(() => {
  setGpuOverride(null)
})

test('the first frame waits for the shader text and is the only frame', async () => {
  const text = deferred<Awaited<ReturnType<ShaderSource['glsl']>>>()
  const { model, log } = mountWithGlsl(() => text.promise)
  await act(async () => {})

  expect(model.currentRenderingBackend).toBeUndefined()
  expect(model.canvasDrawn).toBe(false)
  expect(log.contexts).toEqual([])

  text.resolve(await spanMark.pass.source.glsl())
  await act(async () => {})

  expect(log.contexts).toEqual(['webgl2'])
  expect(model.canvasDrawn).toBe(true)
  expect(model.paintCount).toBe(1)
  expect(log.glDraws).toBe(1)
})

test('text that fails to load leaves the canvas to Canvas2D, which paints', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const failure = new Error('chunk failed to load')
  const { model, log } = mountWithGlsl(() => Promise.reject(failure))
  await act(async () => {})

  expect(log.contexts).toEqual(['2d'])
  expect(model.canvasDrawn).toBe(true)
  expect(log.fills).toBeGreaterThan(0)
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('falling back to Canvas2D'),
    failure,
  )
  warn.mockRestore()
})
