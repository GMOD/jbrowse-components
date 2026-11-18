import { spanMark } from '../marks/spanMark.ts'
import { WebGL2Hal } from './webgl2Hal.ts'

import type { BlendState } from './types.ts'

// A WebGL2 context that links anything and logs the calls that decide where a
// union pass's fragments land: the bound framebuffer, the blend equation, the
// clip and each draw, by which program drew it.
function fakeContext() {
  const log: string[] = []
  const created = { framebuffers: 0, deleted: 0 }
  const names = new Map<unknown, string>()
  let program = ''
  const constants = {
    FRAMEBUFFER: 'FRAMEBUFFER',
    SCISSOR_TEST: 'SCISSOR_TEST',
    MAX: 'MAX',
    FUNC_ADD: 'FUNC_ADD',
    COLOR_BUFFER_BIT: 'COLOR',
  }
  const gl: Record<string, unknown> = {
    ...constants,
    TEXTURE0: 0x84c0,
    INVALID_INDEX: 0xffffffff,
    drawingBufferWidth: 160,
    drawingBufferHeight: 40,
    getParameter: () => 8192,
    getError: () => 0,
    isContextLost: () => false,
    createShader: () => ({}),
    getShaderParameter: () => true,
    createProgram: () => ({}),
    getProgramParameter: () => true,
    getUniformBlockIndex: () => 0,
    getAttribLocation: () => 0,
    getUniformLocation: () => ({}),
    createVertexArray: () => ({}),
    createBuffer: () => ({}),
    createTexture: () => ({}),
    shaderSource: (_shader: unknown, source: string) => {
      if (source.includes('u_layer')) {
        program = 'layerOver'
      }
    },
    linkProgram: (p: object) => {
      names.set(p, program)
      program = ''
    },
    createFramebuffer: () => {
      created.framebuffers++
      const fbo = {}
      names.set(fbo, `layer${created.framebuffers}`)
      return fbo
    },
    deleteFramebuffer: () => {
      created.deleted++
    },
    bindFramebuffer: (_target: unknown, fbo: unknown) => {
      log.push(`bind ${fbo ? names.get(fbo) : 'canvas'}`)
    },
    blendEquation: (mode: string) => {
      log.push(`blend ${mode}`)
    },
    enable: (cap: string) => {
      log.push(`enable ${cap}`)
    },
    disable: (cap: string) => {
      log.push(`disable ${cap}`)
    },
    scissor: (x: number, y: number, w: number, h: number) => {
      log.push(`scissor ${x},${y},${w},${h}`)
    },
    viewport: (x: number, y: number, w: number, h: number) => {
      log.push(`viewport ${x},${y},${w},${h}`)
    },
    clear: () => {
      log.push('clear')
    },
    drawArraysInstanced: () => {
      log.push(`draw ${program || 'pass'}`)
    },
  }
  const noop = () => {}
  const bindProgram = (p: unknown) => {
    program = names.get(p) ?? ''
  }
  const context = new Proxy(gl, {
    get: (target, name: string) =>
      name === 'useProgram'
        ? bindProgram
        : name in target
          ? target[name]
          : noop,
  })
  const canvas = {
    width: 160,
    height: 40,
    style: {},
    addEventListener: noop,
    removeEventListener: noop,
    getContext: (kind: string) => (kind === 'webgl2' ? context : null),
  } as unknown as HTMLCanvasElement
  return { canvas, log, created }
}

async function halWith(blendState: BlendState) {
  const fake = fakeContext()
  const pass = { ...spanMark.pass, id: 'line', blendState }
  const hal = await WebGL2Hal.create(fake.canvas, [pass], 4)
  for (const { name } of pass.textures ?? []) {
    hal.uploadTexture('line', new Uint8Array(4), 1, 1, name)
  }
  for (const regionKey of [0, 1]) {
    hal.uploadBuffer(regionKey, 'line', new ArrayBuffer(pass.instanceStride), 1)
  }
  return { hal, ...fake }
}

// Two blocks meeting mid-pixel share column 100.
function twoBlocks(hal: WebGL2Hal) {
  hal.beginFrame(0, 0, 0, 0)
  hal.setScissor(0, 0, 101, 40)
  hal.setViewport(0, 0, 101, 40)
  hal.drawPass('line', 0)
  hal.setScissor(100, 0, 60, 40)
  hal.setViewport(100, 0, 60, 40)
  hal.drawPass('line', 1)
  hal.endFrame()
}

test('a union pass draws into its layer and composites it under each block', async () => {
  const { hal, log } = await halWith({ op: 'union' })
  twoBlocks(hal)
  log.length = 0
  twoBlocks(hal)

  expect(log).toEqual([
    'disable SCISSOR_TEST',
    'bind layer1',
    'clear',
    'bind canvas',
    'viewport 0,0,160,40',
    'clear',
    'enable SCISSOR_TEST',
    'scissor 0,0,101,40',
    'viewport 0,0,101,40',
    'bind layer1',
    'blend MAX',
    'draw pass',
    'bind canvas',
    'enable SCISSOR_TEST',
    'scissor 0,0,101,40',
    'viewport 0,0,160,40',
    'blend FUNC_ADD',
    'draw layerOver',
    'enable SCISSOR_TEST',
    'scissor 0,0,101,40',
    'viewport 0,0,101,40',
    'enable SCISSOR_TEST',
    'scissor 100,0,60,40',
    'viewport 100,0,60,40',
    'bind layer1',
    'blend MAX',
    'draw pass',
    'bind canvas',
    'enable SCISSOR_TEST',
    'scissor 101,0,59,40',
    'viewport 0,0,160,40',
    'blend FUNC_ADD',
    'draw layerOver',
    'enable SCISSOR_TEST',
    'scissor 100,0,60,40',
    'viewport 100,0,60,40',
    'disable SCISSOR_TEST',
    'viewport 0,0,160,40',
  ])
})

test('a max pass draws straight into the canvas and allocates no layer', async () => {
  const { hal, log, created } = await halWith({ op: 'max' })
  twoBlocks(hal)

  expect(created.framebuffers).toBe(0)
  expect(log.filter(l => l.startsWith('bind') || l === 'clear')).toEqual([
    'bind canvas',
    'clear',
  ])
  expect(log.filter(l => l.startsWith('draw'))).toEqual([
    'draw pass',
    'draw pass',
  ])
})

test('the layer goes with the render targets and comes back at the next draw', async () => {
  const { hal, created } = await halWith({ op: 'union' })
  twoBlocks(hal)
  hal.releaseRenderTargets()
  expect(created).toEqual({ framebuffers: 1, deleted: 1 })
  twoBlocks(hal)
  expect(created).toEqual({ framebuffers: 2, deleted: 1 })
  hal.dispose()
  expect(created).toEqual({ framebuffers: 2, deleted: 2 })
})
