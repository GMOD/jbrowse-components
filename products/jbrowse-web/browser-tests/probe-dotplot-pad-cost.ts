/* eslint-disable no-console */
// What the dotplot capsule's AA pad costs, measured rather than reasoned about.
//
// 333477b51c grew every capsule quad from `halfWidth` to `halfWidth + aaHalf` on
// both axes so the AA ramp has geometry to live in. That is more rasterized area
// per instance — ~40% for a long segment, but up to +96% at dpr 1 for a short
// one, and a whole-genome dotplot is mostly short ones. Whether it costs
// anything on a dense plot was never measured.
//
// This runs the SHIPPED generated GLSL against a real GPU and changes exactly
// one thing between the two variants: the vertex stage's `ext`. The fragment,
// the data, the blend and the draw count are identical, so the delta is the
// pad's rasterization cost and nothing else. Timed with
// EXT_disjoint_timer_query_webgl2 (GPU time, not wall clock, so it is not
// measuring the JS that issues the draw).
//
//     node browser-tests/probe-dotplot-pad-cost.ts [instances] [lineWidth]
import { BASE_CHROME_ARGS } from '@jbrowse/browser-test-utils'
import { launch } from 'puppeteer'

import {
  GLSL_FRAGMENT,
  GLSL_VERTEX,
} from '../../../plugins/dotplot-view/src/DotplotDisplay/shaders/dotplot.generated.ts'

const INSTANCES = Number(process.argv[2] ?? 400000)
const LINE_WIDTH = Number(process.argv[3] ?? 2.5)

// The one edit. `ext` is the quad's half-extent along both axes; the padded
// spelling is what shipped, the unpadded one is the geometry it replaced.
const PADDED = 'float ext_0 = halfWidth_0 + aaHalf_0();'
const UNPADDED = 'float ext_0 = halfWidth_0;'
if (!GLSL_VERTEX.includes(PADDED)) {
  throw new Error(
    'the vertex shader no longer spells ext the way this probe patches',
  )
}

// Headless Chrome falls back to SwiftShader, whose cost is not dominated by
// rasterized area — the very thing being measured — so it reports the pad as
// free. The machine's real GPU needs a headed browser, same as the webgl
// backend in runner.ts. HEADLESS=1 is available but only tells you about
// software rendering.
const browser = await launch({
  headless: process.env.HEADLESS === '1',
  protocolTimeout: 900000,
  args: [
    ...BASE_CHROME_ARGS,
    '--window-size=1400,900',
    // EXT_disjoint_timer_query_webgl2 is off by default (it is a fingerprinting
    // vector). Without it this falls back to wall clock around gl.finish().
    '--enable-webgl-draft-extensions',
  ],
  defaultViewport: { width: 1400, height: 900 },
})

try {
  const page = await browser.newPage()
  page.on('console', m => {
    console.log(`  [page] ${m.text()}`)
  })
  await page.setContent('<canvas id="c" width="1200" height="800"></canvas>')

  const result = await page.evaluate(
    async (vsPadded, vsUnpadded, fsSrc, nInst, lineWidth) => {
      const canvas = document.getElementById('c') as HTMLCanvasElement
      const gl = canvas.getContext('webgl2', {
        antialias: false,
        preserveDrawingBuffer: false,
      })
      if (!gl) {
        return { error: 'no webgl2' }
      }
      const timerExt = gl.getExtension('EXT_disjoint_timer_query_webgl2')

      const compile = (type: number, src: string) => {
        const s = gl.createShader(type)!
        gl.shaderSource(s, src)
        gl.compileShader(s)
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          throw new Error(gl.getShaderInfoLog(s) ?? 'compile failed')
        }
        return s
      }
      const makeProgram = (vsSrc: string) => {
        const p = gl.createProgram()
        gl.attachShader(p, compile(gl.VERTEX_SHADER, vsSrc))
        gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fsSrc))
        gl.linkProgram(p)
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
          throw new Error(gl.getProgramInfoLog(p) ?? 'link failed')
        }
        return p
      }

      // A dense whole-genome-ish plot: short segments (a few bp at this zoom,
      // so they rasterize as dots) scattered over the whole canvas. This is the
      // case the pad costs most, by area ratio.
      const buf = new ArrayBuffer(nInst * 20)
      const f32 = new Float32Array(buf)
      const u32 = new Uint32Array(buf)
      let seed = 12345
      const rnd = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
      }
      for (let i = 0; i < nInst; i++) {
        const o = i * 5
        const x = rnd() * 1200
        const y = rnd() * 800
        f32[o] = x
        f32[o + 1] = y
        f32[o + 2] = x + rnd() * 3
        f32[o + 3] = y + rnd() * 3
        u32[o + 4] = 0xff000000 | (i & 0xffffff)
      }

      const vbo = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
      gl.bufferData(gl.ARRAY_BUFFER, buf, gl.STATIC_DRAW)

      const ubo = gl.createBuffer()
      const ub = new ArrayBuffer(48)
      const uf = new Float32Array(ub)
      uf[0] = 1200
      uf[1] = 800
      uf[2] = lineWidth
      uf[3] = 0 // panPxH
      uf[4] = 1 // bpPerPxHInv — data is already in px
      uf[5] = 0 // panPxV
      uf[6] = 1 // bpPerPxVInv
      uf[7] = 1 // alpha
      uf[8] = 1 // devicePixelRatio
      gl.bindBuffer(gl.UNIFORM_BUFFER, ubo)
      gl.bufferData(gl.UNIFORM_BUFFER, ub, gl.STATIC_DRAW)
      gl.bindBufferBase(gl.UNIFORM_BUFFER, 1, ubo)

      const setupAttribs = (p: WebGLProgram) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
        const names = ['a_x1', 'a_y1', 'a_x2', 'a_y2', 'a_color']
        for (const [i, name] of names.entries()) {
          const loc = gl.getAttribLocation(p, name)
          if (loc < 0) {
            continue
          }
          gl.enableVertexAttribArray(loc)
          if (name === 'a_color') {
            gl.vertexAttribIPointer(loc, 1, gl.UNSIGNED_INT, 20, 16)
          } else {
            gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 20, i * 4)
          }
          gl.vertexAttribDivisor(loc, 1)
        }
        const idx = gl.getUniformBlockIndex(p, 'Uniforms')
        if (idx !== 0xffffffff) {
          gl.uniformBlockBinding(p, idx, 1)
        }
      }

      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.viewport(0, 0, 1200, 800)

      // One timed pass over `reps` draws, returned in ms/frame. Prefers the GPU
      // timer; without it, wall clock around a readPixels, which blocks until
      // the GPU has actually finished (gl.finish alone is advisory on some
      // drivers). The fallback includes the JS issuing the draws — identical
      // between the variants, so it inflates both and understates the ratio
      // rather than inventing one.
      const px = new Uint8Array(4)
      const timePass = async (p: WebGLProgram, reps: number) => {
        if (timerExt) {
          const q = gl.createQuery()
          gl.beginQuery(timerExt.TIME_ELAPSED_EXT, q)
          for (let i = 0; i < reps; i++) {
            gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nInst)
          }
          gl.endQuery(timerExt.TIME_ELAPSED_EXT)
          gl.flush()
          for (let i = 0; i < 600; i++) {
            await new Promise(r => setTimeout(r, 10))
            if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
              if (gl.getParameter(timerExt.GPU_DISJOINT_EXT)) {
                return null
              }
              return gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6 / reps
            }
          }
          return null
        }
        const t0 = performance.now()
        for (let i = 0; i < reps; i++) {
          gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nInst)
        }
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
        return (performance.now() - t0) / reps
      }

      const programs = {
        padded: makeProgram(vsPadded),
        unpadded: makeProgram(vsUnpadded),
      }
      const out = { padded: [] as number[], unpadded: [] as number[] }

      // Interleave the variants and take the median: a GPU that clocks up or
      // down mid-run otherwise assigns the whole drift to whichever ran second.
      for (let round = 0; round < 11; round++) {
        for (const key of ['padded', 'unpadded'] as const) {
          const p = programs[key]
          gl.useProgram(p)
          setupAttribs(p)
          if (round === 0) {
            await timePass(p, 3) // warm up, discarded
          }
          const ms = await timePass(p, 30)
          if (ms !== null) {
            out[key].push(ms)
          }
          console.log(
            `round ${round} ${key} ${ms === null ? 'disjoint' : ms.toFixed(3)}`,
          )
        }
      }
      return {
        padded: out.padded,
        unpadded: out.unpadded,
        timer: timerExt
          ? 'EXT_disjoint_timer_query_webgl2'
          : 'wall clock + readPixels',
        renderer: (() => {
          const dbg = gl.getExtension('WEBGL_debug_renderer_info')
          return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unknown'
        })(),
      }
    },
    GLSL_VERTEX,
    GLSL_VERTEX.replace(PADDED, UNPADDED),
    GLSL_FRAGMENT,
    INSTANCES,
    LINE_WIDTH,
  )

  if ('error' in result) {
    throw new Error(String(result.error))
  }
  const median = (a: number[]) =>
    [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!
  const p = median(result.padded)
  const u = median(result.unpadded)
  console.log(`renderer: ${result.renderer}`)
  console.log(`timer: ${result.timer}`)
  console.log(`instances: ${INSTANCES}  lineWidth: ${LINE_WIDTH}  dpr: 1`)
  console.log(
    `  padded   ${p.toFixed(3)} ms/frame  [${result.padded.map(v => v.toFixed(2)).join(' ')}]`,
  )
  console.log(
    `  unpadded ${u.toFixed(3)} ms/frame  [${result.unpadded.map(v => v.toFixed(2)).join(' ')}]`,
  )
  console.log(
    `  pad costs ${(((p - u) / u) * 100).toFixed(1)}%  (${(p - u).toFixed(3)} ms/frame)`,
  )
} finally {
  await browser.close()
}
