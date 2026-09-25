// What does a frame cost once a focus hides most of a region's rows through
// the row table, with every instance still in the buffer and the vertex stage
// collapsing the hidden ones — against the same picture from a buffer packed
// down to the kept rows, and against the whole region drawn?
//
//   node plugins/canvas/benches/rowTableFrame.probe.ts
//   node plugins/canvas/benches/rowTableFrame.probe.ts --rows=1000 --features=500000 --kept=10 --real-gpu
//
// A PROBE: it draws the span pass's own GLSL on a bare WebGL2 context in
// headless Chrome, one instanced draw per frame, and sizes the vertex work a
// hidden instance still costs. Headless Chrome renders on SwiftShader unless
// `--real-gpu` (`--use-gl=angle`) is passed, and the renderer string is
// printed so a SwiftShader number is never mistaken for a GPU's. The harness
// rules apply and are in agent-docs/reference/BENCHMARKING.md: the arms are
// interleaved frame by frame, the min and the median are both reported, and
// `all-control` is a second arm over the same buffer as `all`. The tables come
// from `buildRowTable`; the instances are packed in the page, in the span
// struct's own lane order, since the region is too large to hand over.
//
//   all              every row kept, the whole buffer: what a pan costs before a focus
//   all-control      the same draw through a second arm
//   focus-table      `kept` rows kept in the table, the whole buffer: hidden instances collapse in the vertex stage
//   focus-packed     `kept` rows kept, a buffer holding only their instances: the compacting alternative
//   no-table         the whole buffer with no table bound, the pass as it drew before the table
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { HIDDEN_ROW, buildRowTable } from '@jbrowse/render-core/marks'
import puppeteer from 'puppeteer'

import * as shader from '../../../packages/render-core/src/shaders/spanMark.generated.ts'

const arg = (name: string, fallback: number) =>
  Number(
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] ??
      fallback,
  )
const rows = arg('rows', 1000)
const features = arg('features', 500_000)
const kept = arg('kept', 10)
const frames = arg('frames', 40)
const realGpu = process.argv.includes('--real-gpu')

const CANVAS_W = 1600
const CANVAS_H = 1000
const perRow = Math.floor(features / rows)
const lengthBp = perRow * 1100

function tableKeeping(keys: number) {
  const slot = new Uint32Array(rows).fill(HIDDEN_ROW)
  for (let key = 0; key < keys; key++) {
    slot[key] = key
  }
  return buildRowTable(slot)
}

function uniformsFor(rowTableKeys: number) {
  const buf = new ArrayBuffer(shader.UNIFORMS_SIZE_BYTES)
  shader.writeUniforms(buf, {
    bpRangeX: [0, 0, lengthBp],
    canvasHeight: CANVAS_H,
    minCellDenomPx: CANVAS_W,
    minCellPx: 2,
    zero: 0,
    rowHeight: CANVAS_H / rows,
    rowProportion: 1,
    scrollTop: 0,
    rowTableKeys,
  })
  return [...new Uint8Array(buf)]
}

interface Arm {
  name: string
  keptRows: number
  table: { bytes: number[]; width: number; height: number }
  uniforms: number[]
}

function arm(name: string, keptRows: number, rowTableKeys: number): Arm {
  const table = tableKeeping(rows)
  const focused = tableKeeping(kept)
  const t = keptRows === rows ? table : focused
  return {
    name,
    keptRows,
    table: {
      bytes: [...t.texture.bytes],
      width: t.texture.width,
      height: t.texture.height,
    },
    uniforms: uniformsFor(rowTableKeys),
  }
}

const ARMS: Arm[] = [
  arm('all', rows, rows),
  arm('all-control', rows, rows),
  arm('focus-table', rows, rows),
  arm('focus-packed', kept, rows),
  arm('no-table', rows, -1),
]
ARMS[2]!.table = arm('focus', kept, rows).table

const here = path.dirname(fileURLToPath(import.meta.url))
const glsl = readFileSync(
  path.join(
    here,
    '../../../packages/render-core/src/shaders/spanMark.glsl.generated.ts',
  ),
  'utf8',
)
const stringConst = (name: string) => {
  const m = new RegExp(`export const ${name} = (".*")`).exec(glsl)
  if (!m) {
    throw new Error(`no ${name} in spanMark.glsl.generated.ts`)
  }
  return JSON.parse(m[1]!) as string
}
const vertex = stringConst('GLSL_VERTEX')
const fragment = stringConst('GLSL_FRAGMENT')

const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    ...(realGpu
      ? ['--use-gl=angle', '--ignore-gpu-blocklist']
      : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']),
  ],
})
try {
  const page = await browser.newPage()
  await page.goto('about:blank')
  const result = await page.evaluate(
    ({ arms, vertex, fragment, w, h, frames, stride, rows, perRow }) => {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const gl = canvas.getContext('webgl2', { antialias: false })
      if (!gl) {
        throw new Error('no webgl2')
      }
      const info = gl.getExtension('WEBGL_debug_renderer_info')
      const renderer = info
        ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))
        : 'unknown'
      const compile = (type: number, src: string) => {
        const s = gl.createShader(type)!
        gl.shaderSource(s, src)
        gl.compileShader(s)
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(s) ?? 'compile failed')
        }
        return s
      }
      const program = gl.createProgram()
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex))
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment))
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? 'link failed')
      }
      gl.useProgram(program)
      gl.uniformBlockBinding(
        program,
        gl.getUniformBlockIndex(program, 'Uniforms'),
        0,
      )
      gl.uniform1i(gl.getUniformLocation(program, 'u_rowTable'), 0)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      gl.viewport(0, 0, w, h)

      // The region: `perRow` intervals tiling each row, the span struct's
      // x, x2, row, color lanes, one instance per 16 bytes.
      let seed = rows * 7919 + perRow
      const rand = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0
        return seed / 4294967296
      }
      const palette = [0xff4c72b0, 0xffdd8452, 0xff55a868, 0xffc44e52]
      const pack = (keptRows: number) => {
        const words = new Uint32Array(keptRows * perRow * 4)
        let i = 0
        for (let r = 0; r < keptRows; r++) {
          let pos = 0
          for (let k = 0; k < perRow; k++) {
            const len = 100 + Math.floor(rand() * 2000)
            words[i * 4] = pos
            words[i * 4 + 1] = pos + len
            words[i * 4 + 2] = r
            words[i * 4 + 3] = palette[Math.floor(rand() * palette.length)]!
            pos += len
            i++
          }
        }
        return words
      }
      const built = arms.map(a => {
        const words = pack(a.keptRows)
        const vao = gl.createVertexArray()
        gl.bindVertexArray(vao)
        const vbo = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
        gl.bufferData(gl.ARRAY_BUFFER, words, gl.STATIC_DRAW)
        for (let loc = 0; loc < 4; loc++) {
          gl.enableVertexAttribArray(loc)
          gl.vertexAttribIPointer(loc, 1, gl.UNSIGNED_INT, stride, loc * 4)
          gl.vertexAttribDivisor(loc, 1)
        }
        const ubo = gl.createBuffer()
        gl.bindBuffer(gl.UNIFORM_BUFFER, ubo)
        gl.bufferData(
          gl.UNIFORM_BUFFER,
          Uint8Array.from(a.uniforms),
          gl.STATIC_DRAW,
        )
        const tex = gl.createTexture()
        gl.bindTexture(gl.TEXTURE_2D, tex)
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          a.table.width,
          a.table.height,
          0,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          Uint8Array.from(a.table.bytes),
        )
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        return { vao, ubo, tex, count: words.length / 4 }
      })
      const pixels = new Uint8Array(4)
      // A one-pixel read is what waits for the draw: `finish` returned at
      // once on SwiftShader and timed nothing.
      const draw = (b: (typeof built)[number]) => {
        gl.clearColor(1, 1, 1, 1)
        gl.clear(gl.COLOR_BUFFER_BIT)
        gl.bindVertexArray(b.vao)
        gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, b.ubo)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, b.tex)
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, b.count)
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
      }
      // Slot i is canvas row i from the top, GL row h - 1 - i from the bottom.
      const slots = Array.from({ length: 50 }, (_, i) => i * 20)
      const inked = built.map(b => {
        draw(b)
        let ink = 0
        for (const slot of slots) {
          gl.readPixels(
            800,
            h - 1 - slot,
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            pixels,
          )
          ink += pixels[0] !== 255 || pixels[1] !== 255 ? 1 : 0
        }
        return ink
      })
      for (let f = 0; f < 5; f++) {
        for (const b of built) {
          draw(b)
        }
      }
      const times = built.map(() => [] as number[])
      for (let f = 0; f < frames; f++) {
        for (const [i, b] of built.entries()) {
          const t0 = performance.now()
          draw(b)
          times[i]!.push(performance.now() - t0)
        }
      }
      return {
        renderer,
        counts: built.map(b => b.count),
        inked,
        times: times.map(t => {
          const sorted = t.toSorted((a, b) => a - b)
          return { min: sorted[0]!, median: sorted[sorted.length >> 1]! }
        }),
      }
    },
    {
      arms: ARMS,
      vertex,
      fragment,
      w: CANVAS_W,
      h: CANVAS_H,
      frames,
      stride: shader.INSTANCE_STRIDE_BYTES,
      rows,
      perRow,
    },
  )
  console.log(`renderer: ${result.renderer}`)
  console.log(
    `${rows} rows, ${(rows * perRow).toLocaleString()} instances, ${kept} kept, ${frames} frames per arm, interleaved`,
  )
  for (const [i, a] of ARMS.entries()) {
    const { min, median } = result.times[i]!
    console.log(
      `  ${a.name.padEnd(13)} ${result.counts[i]!.toLocaleString().padStart(9)} instances  ` +
        `min ${min.toFixed(2).padStart(7)}ms  median ${median.toFixed(2).padStart(7)}ms  ` +
        `${result.inked[i]} of 50 sampled slots inked`,
    )
  }
} finally {
  await browser.close()
}
