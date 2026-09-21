import { pointMark } from '../marks/pointMark.ts'
import { spanMark } from '../marks/spanMark.ts'
import { WebGL2Hal } from './webgl2Hal.ts'

import type { PipelineDescriptor, TextureBinding } from './types.ts'

const TEXTURE0 = 0x84c0

// A WebGL2 context that links whatever it is handed, except a vertex source
// containing `broken`, and records what it built and bound.
function fakeContext() {
  const log = {
    compiles: [] as string[],
    programs: 0,
    deletedPrograms: 0,
    deletedTextures: 0,
    drawn: [] as unknown[],
  }
  let unit = 0
  let lastSource = ''
  const units = new Map<number, unknown>()
  const handles = new Map<object, string>()
  const gl: Record<string, unknown> = {
    TEXTURE0,
    INVALID_INDEX: 0xffffffff,
    NO_ERROR: 0,
    getParameter: () => 8192,
    getError: () => 0,
    isContextLost: () => false,
    createShader: () => ({}),
    shaderSource: (shader: object, source: string) => {
      handles.set(shader, source)
      lastSource = source
    },
    compileShader: () => {
      log.compiles.push(lastSource)
    },
    getShaderParameter: (shader: object) =>
      !handles.get(shader)?.includes('broken'),
    getShaderInfoLog: () => 'broken on purpose',
    createProgram: () => {
      log.programs++
      return {}
    },
    getProgramParameter: () => true,
    deleteProgram: () => {
      log.deletedPrograms++
    },
    getUniformBlockIndex: () => 0,
    getAttribLocation: () => 0,
    getUniformLocation: () => ({}),
    createVertexArray: () => ({}),
    createBuffer: () => ({}),
    createTexture: () => ({}),
    deleteTexture: () => {
      log.deletedTextures++
    },
    activeTexture: (u: number) => {
      unit = u - TEXTURE0
    },
    bindTexture: (_target: unknown, texture: unknown) => {
      units.set(unit, texture)
    },
    drawArraysInstanced: () => {
      log.drawn.push(units.get(0))
    },
  }
  const noop = () => {}
  const context = new Proxy(gl, {
    get: (target, name: string) => (name in target ? target[name] : noop),
  })
  const canvas = {
    width: 100,
    height: 40,
    style: {},
    addEventListener: noop,
    removeEventListener: noop,
    getContext: (kind: string) => (kind === 'webgl2' ? context : null),
  } as unknown as HTMLCanvasElement
  return { canvas, log }
}

const RAMP: TextureBinding = {
  glTextureUnit: 0,
  glUniformName: 'u_colorRamp',
  filter: 'linear',
}

const pass = (id: string, over: Partial<PipelineDescriptor> = {}) => ({
  ...spanMark.pass,
  id,
  ...over,
})

function drawEach(hal: WebGL2Hal, ids: string[]) {
  ids.forEach((id, key) => {
    hal.uploadBuffer(key, id, new ArrayBuffer(spanMark.pass.instanceStride), 1)
  })
  hal.beginFrame(0, 0, 0, 0)
  ids.forEach((id, key) => {
    hal.drawPass(id, key)
  })
  hal.endFrame()
}

test('passes that differ only in id link one program on a context', async () => {
  const { canvas, log } = fakeContext()
  const hal = await WebGL2Hal.create(canvas, [
    pass('span'),
    pass('span#0'),
    pass('span#1'),
    { ...pointMark.pass, id: 'point' },
  ])
  drawEach(hal, ['span', 'span#0', 'span#1'])
  expect(log.programs).toBe(1)
  drawEach(hal, ['point'])
  expect(log.programs).toBe(2)
  hal.dispose()
  expect(log.deletedPrograms).toBe(2)
})

test('each pass keeps its own texture over a shared program', async () => {
  const { canvas, log } = fakeContext()
  const hal = await WebGL2Hal.create(canvas, [
    pass('ring0', { textures: [RAMP] }),
    pass('ring1', { textures: [RAMP] }),
  ])
  const a = new Uint8Array(4).fill(1)
  const b = new Uint8Array(4).fill(2)
  hal.uploadTexture('ring0', a, 1, 1)
  hal.uploadTexture('ring1', b, 1, 1)
  drawEach(hal, ['ring0', 'ring1'])
  expect(log.programs).toBe(1)
  const [first, second] = log.drawn
  expect(first).toBeDefined()
  expect(second).toBeDefined()
  expect(second).not.toBe(first)
  hal.dispose()
  expect(log.deletedTextures).toBe(2)
})

test('a program that fails to link is compiled once and reported for each pass', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {})
  const { canvas, log } = fakeContext()
  const stages = await spanMark.pass.source.glsl()
  const broken = {
    source: {
      ...spanMark.pass.source,
      glsl: () =>
        Promise.resolve({
          ...stages,
          GLSL_VERTEX: `${stages.GLSL_VERTEX}\n// broken`,
        }),
    },
  }
  const hal = await WebGL2Hal.create(canvas, [
    pass('span'),
    pass('bad0', broken),
    pass('bad1', broken),
  ])
  const reported: string[] = []
  hal.setErrorHandler(e => {
    reported.push(e.message)
  })
  drawEach(hal, ['bad0', 'bad1', 'bad0'])
  expect(log.compiles.filter(s => s.includes('broken'))).toHaveLength(1)
  expect(reported).toEqual([
    expect.stringContaining('"bad0"'),
    expect.stringContaining('"bad1"'),
  ])
})
