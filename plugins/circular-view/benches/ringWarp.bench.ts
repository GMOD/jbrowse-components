// What a ring costs per frame under the two coordinate stages a circular view
// could put over a linear display: warping the display's finished strip in
// polar coordinates against drawing every instance as a wedge.
//
//   node plugins/circular-view/benches/ringWarp.bench.ts --bins=5278
//   node plugins/circular-view/benches/ringWarp.bench.ts --bins=10
//   node plugins/circular-view/benches/ringWarp.bench.ts --bins=5278 --gpu=swiftshader
//
// Flags: --bins=<n> (required; one fixture per process), --rounds=<n>,
// --frames=<n>, --gpu=angle|swiftshader (default angle: the machine's GPU
// through ANGLE, which is what a user's Chrome does; swiftshader is CPU
// rasterisation and only says which arm is heavier, never how heavy).
//
// The harness rules are agent-docs/reference/BENCHMARKING.md: arms interleaved
// round-robin in one page, min of rounds, and a control arm that is the warp
// written out a second time so `control / warp` is what the page could resolve.
//
// THE FIGURE. A 1000 css px circular view at dpr 2 — 2000 device px, 80 css px
// of padding — puts the ruler at 840 device px, and the ring under it takes a
// 100 css px display as a 200 device px band. The strip a linear display
// renders for that ring is the ring's circumference wide: 5278 device px.
//
// THE FIXTURE. `--bins` coverage-shaped bars across the strip, each a random
// height: 5278 is one bar per device column, the shape a 300x coverage band
// takes at any zoom where its bins are pixels; 10 is ten wide bins, the
// worst case for a wedge drawn with straight edges.
//
// ARMS, WebGL2:
//   warp        one quad over the annulus; the fragment takes atan2, samples
//               the strip texture in polar coordinates and fades the two rims
//   control     the warp arm again, separately declared
//   restrip     the warp plus the strip canvas re-uploaded as a texture — the
//               frame a zoom or a data arrival costs on top of a rotation
//   wedge1      `bins` instances drawn as one quad each, corners placed in polar
//               coordinates by the vertex shader — the polar twin of a bar
//   wedge8      the same with eight segments per instance, which is what a
//               36-degree bin needs to keep its arc within half a pixel
// and Canvas2D:
//   c2d-warp    the strip drawn as one rotated one-device-pixel slice per
//               column
//   c2d-wedge   each bar as an arc path
//
// Each frame finishes with a 1x1 `readPixels` / `getImageData`, so the time is
// the raster and not the enqueue — `gl.finish()` returns without waiting on
// Chrome's GPU process.
//
// Beside the timing, `wedge1` and `wedge8` are each read back and compared
// against `warp` over the ring, as the fraction of ring pixels whose colour
// differs and the mean absolute difference on those — which is the arc
// exactness question (b) in ADR-119, measured rather than argued.

import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'

import type { PuppeteerNode } from 'puppeteer'

const { values } = parseArgs({
  options: {
    bins: { type: 'string' },
    rounds: { type: 'string', default: '10' },
    frames: { type: 'string', default: '6' },
    gpu: { type: 'string', default: 'angle' },
  },
})
if (!values.bins) {
  console.error('--bins=<n> is required; one fixture per process')
  process.exit(1)
}
const bins = Number(values.bins)
const rounds = Number(values.rounds)
const frames = Number(values.frames)

const require = createRequire(
  new URL('../../../packages/browser-test-utils/package.json', import.meta.url),
)
const puppeteer = require('puppeteer') as PuppeteerNode

const DPR = 2
const FIGURE_PX = 1000 * DPR
const OUTER_PX = 420 * DPR
const BAND_PX = 100 * DPR
const INNER_PX = OUTER_PX - BAND_PX
const STRIP_W = Math.round(2 * Math.PI * OUTER_PX)
const TWO_PI = 2 * Math.PI

const pageScript = String.raw`
const DPR = ${DPR}
const FIGURE_PX = ${FIGURE_PX}
const OUTER_PX = ${OUTER_PX}
const BAND_PX = ${BAND_PX}
const INNER_PX = ${INNER_PX}
const STRIP_W = ${STRIP_W}
const TWO_PI = ${TWO_PI}
const BINS = ${bins}
const ROUNDS = ${rounds}
const FRAMES = ${frames}

// One deterministic coverage profile per fixture, shared by every arm.
let seed = 12345
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const x0 = new Float32Array(BINS)
const x1 = new Float32Array(BINS)
const h = new Float32Array(BINS)
for (let i = 0; i < BINS; i++) {
  x0[i] = (i * STRIP_W) / BINS
  x1[i] = ((i + 1) * STRIP_W) / BINS
  h[i] = BAND_PX * (0.2 + 0.8 * rand())
}

const strip = document.createElement('canvas')
strip.width = STRIP_W
strip.height = BAND_PX
{
  const c = strip.getContext('2d')
  c.fillStyle = '#4c78a8'
  for (let i = 0; i < BINS; i++) {
    c.fillRect(x0[i], BAND_PX - h[i], x1[i] - x0[i], h[i])
  }
}

function makeCanvas() {
  const el = document.createElement('canvas')
  el.width = FIGURE_PX
  el.height = FIGURE_PX
  document.body.append(el)
  return el
}

function compile(gl, vs, fs) {
  const p = gl.createProgram()
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(s))
    }
    gl.attachShader(p, s)
  }
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p))
  }
  return p
}

const WARP_VS = '#version 300 es\n' +
  'uniform vec2 u_center; uniform float u_outer; uniform vec2 u_canvas;\n' +
  'void main(){ int v = gl_VertexID % 6;\n' +
  ' float qx = (v==0||v==2||v==3) ? 0.0 : 1.0; float qy = (v==0||v==1||v==4) ? 0.0 : 1.0;\n' +
  ' vec2 px = u_center + (vec2(qx,qy)*2.0-1.0)*(u_outer+1.0);\n' +
  ' gl_Position = vec4(px/u_canvas*2.0-1.0, 0.0, 1.0); }'
const WARP_FS = '#version 300 es\nprecision highp float;\n' +
  'uniform vec2 u_center; uniform float u_outer; uniform float u_inner; uniform float u_rot; uniform vec2 u_canvas;\n' +
  'uniform sampler2D u_strip; out vec4 o;\n' +
  'void main(){ vec2 p = vec2(gl_FragCoord.x, u_canvas.y - gl_FragCoord.y) - u_center; float r = length(p);\n' +
  ' float cov = clamp(u_outer - r + 0.5, 0.0, 1.0) * clamp(r - u_inner + 0.5, 0.0, 1.0);\n' +
  ' if (cov <= 0.0) discard;\n' +
  ' float a = atan(p.y, p.x) - u_rot; a -= floor(a / ${TWO_PI}) * ${TWO_PI};\n' +
  ' vec4 c = texture(u_strip, vec2(a / ${TWO_PI}, (u_outer - r) / (u_outer - u_inner)));\n' +
  ' o = c * cov; }'

const WEDGE_VS = '#version 300 es\n' +
  'in float a_x0; in float a_x1; in float a_h;\n' +
  'uniform vec2 u_center; uniform float u_inner; uniform vec2 u_canvas; uniform float u_rot; uniform int u_segs;\n' +
  'void main(){ int v = gl_VertexID % 6; int s = (gl_VertexID / 6) % u_segs;\n' +
  ' float qx = (v==0||v==2||v==3) ? 0.0 : 1.0; float qy = (v==0||v==1||v==4) ? 0.0 : 1.0;\n' +
  ' float t = (float(s) + qx) / float(u_segs);\n' +
  ' float a = mix(a_x0, a_x1, t) / ${STRIP_W}.0 * ${TWO_PI} + u_rot;\n' +
  ' float r = mix(u_inner, u_inner + a_h, qy);\n' +
  ' vec2 px = u_center + r * vec2(cos(a), sin(a));\n' +
  ' gl_Position = vec4(px.x/u_canvas.x*2.0-1.0, 1.0-px.y/u_canvas.y*2.0, 0.0, 1.0); }'
const WEDGE_FS = '#version 300 es\nprecision highp float; out vec4 o;\n' +
  'void main(){ o = vec4(0.298, 0.471, 0.659, 1.0); }'

const probe = new Uint8Array(4)
function glArm(name, kind) {
  const canvas = makeCanvas()
  const gl = canvas.getContext('webgl2', { premultipliedAlpha: true, preserveDrawingBuffer: true })
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  gl.viewport(0, 0, FIGURE_PX, FIGURE_PX)
  const center = [FIGURE_PX / 2, FIGURE_PX / 2]
  if (kind === 'warp' || kind === 'restrip') {
    const prog = compile(gl, WARP_VS, WARP_FS)
    gl.useProgram(prog)
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, strip)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.uniform2f(gl.getUniformLocation(prog, 'u_center'), center[0], center[1])
    gl.uniform1f(gl.getUniformLocation(prog, 'u_outer'), OUTER_PX)
    gl.uniform1f(gl.getUniformLocation(prog, 'u_inner'), INNER_PX)
    gl.uniform2f(gl.getUniformLocation(prog, 'u_canvas'), FIGURE_PX, FIGURE_PX)
    gl.uniform1i(gl.getUniformLocation(prog, 'u_strip'), 0)
    const rotLoc = gl.getUniformLocation(prog, 'u_rot')
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    return {
      name,
      canvas,
      frame(rot) {
        gl.clearColor(0, 0, 0, 0)
        gl.clear(gl.COLOR_BUFFER_BIT)
        if (kind === 'restrip') {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, strip)
        }
        gl.uniform1f(rotLoc, rot)
        gl.drawArrays(gl.TRIANGLES, 0, 6)
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, probe)
      },
    }
  }
  const segs = kind === 'wedge1' ? 1 : 8
  const prog = compile(gl, WEDGE_VS, WEDGE_FS)
  gl.useProgram(prog)
  const vao = gl.createVertexArray()
  gl.bindVertexArray(vao)
  const data = new Float32Array(BINS * 3)
  for (let i = 0; i < BINS; i++) {
    data[i * 3] = x0[i]
    data[i * 3 + 1] = x1[i]
    data[i * 3 + 2] = h[i]
  }
  const vbo = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  for (const [j, attr] of ['a_x0', 'a_x1', 'a_h'].entries()) {
    const loc = gl.getAttribLocation(prog, attr)
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 12, j * 4)
    gl.vertexAttribDivisor(loc, 1)
  }
  gl.uniform2f(gl.getUniformLocation(prog, 'u_center'), center[0], center[1])
  gl.uniform1f(gl.getUniformLocation(prog, 'u_inner'), INNER_PX)
  gl.uniform2f(gl.getUniformLocation(prog, 'u_canvas'), FIGURE_PX, FIGURE_PX)
  gl.uniform1i(gl.getUniformLocation(prog, 'u_segs'), segs)
  const rotLoc = gl.getUniformLocation(prog, 'u_rot')
  return {
    name,
    canvas,
    frame(rot) {
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform1f(rotLoc, rot)
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6 * segs, BINS)
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, probe)
    },
  }
}

function c2dArm(name, kind) {
  const canvas = makeCanvas()
  const ctx = canvas.getContext('2d')
  const cx = FIGURE_PX / 2
  const cy = FIGURE_PX / 2
  return {
    name,
    canvas,
    frame(rot) {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, FIGURE_PX, FIGURE_PX)
      if (kind === 'c2d-warp') {
        for (let i = 0; i < STRIP_W; i++) {
          const a = ((i + 0.5) / STRIP_W) * TWO_PI + rot + Math.PI / 2
          ctx.setTransform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), cx, cy)
          ctx.drawImage(strip, i, 0, 1, BAND_PX, -0.5, -OUTER_PX, 1, BAND_PX)
        }
      } else {
        ctx.fillStyle = '#4c78a8'
        for (let i = 0; i < BINS; i++) {
          const a0 = (x0[i] / STRIP_W) * TWO_PI + rot
          const a1 = (x1[i] / STRIP_W) * TWO_PI + rot
          ctx.beginPath()
          ctx.arc(cx, cy, INNER_PX + h[i], a0, a1)
          ctx.arc(cx, cy, INNER_PX, a1, a0, true)
          ctx.closePath()
          ctx.fill()
        }
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.getImageData(0, 0, 1, 1)
    },
  }
}

const arms = [
  glArm('warp', 'warp'),
  glArm('control', 'warp'),
  glArm('restrip', 'restrip'),
  glArm('wedge1', 'wedge1'),
  glArm('wedge8', 'wedge8'),
  c2dArm('c2d-warp', 'c2d-warp'),
  c2dArm('c2d-wedge', 'c2d-wedge'),
]

for (const arm of arms) {
  for (let f = 0; f < 3; f++) {
    arm.frame(f * 0.01)
  }
}

const best = new Map(arms.map(a => [a.name, Infinity]))
for (let r = 0; r < ROUNDS; r++) {
  const order = arms.map((_, i) => (i + r) % arms.length)
  for (const i of order) {
    const arm = arms[i]
    const t0 = performance.now()
    for (let f = 0; f < FRAMES; f++) {
      arm.frame(f * 0.03)
    }
    const ms = (performance.now() - t0) / FRAMES
    if (ms < best.get(arm.name)) {
      best.set(arm.name, ms)
    }
  }
}

function ringPixels(arm) {
  arm.frame(0)
  const tmp = document.createElement('canvas')
  tmp.width = FIGURE_PX
  tmp.height = FIGURE_PX
  const c = tmp.getContext('2d')
  c.drawImage(arm.canvas, 0, 0)
  return c.getImageData(0, 0, FIGURE_PX, FIGURE_PX).data
}
function inked(px) {
  let inside = 0
  let on = 0
  const cx = FIGURE_PX / 2
  const cy = FIGURE_PX / 2
  for (let y = 0; y < FIGURE_PX; y++) {
    for (let x = 0; x < FIGURE_PX; x++) {
      const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      if (r < INNER_PX + 1 || r > OUTER_PX - 1) {
        continue
      }
      inside++
      if (px[(y * FIGURE_PX + x) * 4 + 3] > 8) {
        on++
      }
    }
  }
  return on / inside
}
function compare(a, b) {
  let inside = 0
  let differ = 0
  let sum = 0
  const cx = FIGURE_PX / 2
  const cy = FIGURE_PX / 2
  for (let y = 0; y < FIGURE_PX; y++) {
    for (let x = 0; x < FIGURE_PX; x++) {
      const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      if (r < INNER_PX + 1 || r > OUTER_PX - 1) {
        continue
      }
      inside++
      const i = (y * FIGURE_PX + x) * 4
      const d = Math.abs(a[i + 3] - b[i + 3])
      if (d > 8) {
        differ++
        sum += d
      }
    }
  }
  return { fraction: differ / inside, meanAbs: differ ? sum / differ : 0 }
}
const pixels = new Map(arms.map(a => [a.name, ringPixels(a)]))
const warpPx = pixels.get('warp')
const exact = {
  wedge1: compare(warpPx, pixels.get('wedge1')),
  wedge8: compare(warpPx, pixels.get('wedge8')),
  'c2d-warp': compare(warpPx, pixels.get('c2d-warp')),
  'c2d-wedge': compare(warpPx, pixels.get('c2d-wedge')),
}
window.__result = {
  timing: Object.fromEntries(best),
  inked: Object.fromEntries([...pixels].map(([k, v]) => [k, inked(v)])),
  exact,
  renderer: (() => {
    const gl = arms[0].canvas.getContext('webgl2')
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown'
  })(),
}
`

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 900_000,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    args:
      values.gpu === 'swiftshader'
        ? ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']
        : ['--use-gl=angle', '--ignore-gpu-blocklist'],
  })
  try {
    const page = await browser.newPage()
    page.on('console', m => {
      console.error('[page]', m.text())
    })
    await page.setContent('<html><body></body></html>')
    await page.evaluate(pageScript)
    const result = (await page.evaluate('window.__result')) as {
      timing: Record<string, number>
      inked: Record<string, number>
      exact: Record<string, { fraction: number; meanAbs: number }>
      renderer: string
    }
    const base = result.timing.warp!
    console.log(`bins=${bins} gpu=${values.gpu} renderer=${result.renderer}`)
    console.log('arm\tms/frame\tvs warp\tring inked')
    for (const [arm, ms] of Object.entries(result.timing)) {
      console.log(
        `${arm}\t${ms.toFixed(3)}\t${(ms / base).toFixed(2)}x\t${(result.inked[arm]! * 100).toFixed(1)}%`,
      )
    }
    console.log('exactness against the warp, over the ring band:')
    for (const [arm, e] of Object.entries(result.exact)) {
      console.log(
        `${arm}\t${(e.fraction * 100).toFixed(2)}% of pixels differ\tmean |dA| ${e.meanAbs.toFixed(1)}/255`,
      )
    }
  } finally {
    await browser.close()
  }
}

await main()
