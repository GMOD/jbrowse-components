/**
 * Benchmark script comparing Canvas 2D vs WebGL rendering for synteny display
 *
 * Run with: npx tsx benchmarkWebGL.ts
 * (requires a DOM environment, so use jsdom or run in browser)
 */

import { SyntenyWebGLRenderer, createColorFunction } from './drawSyntenyWebGL'
import type { FeatPos } from './model'

interface BenchmarkResult {
  name: string
  featureCount: number
  buildTimeMs: number
  renderTimeMs: number
  pickTimeMs: number
  totalTriangles: number
}

/**
 * Generate synthetic test features
 */
function generateTestFeatures(count: number, width: number): FeatPos[] {
  const features: FeatPos[] = []
  const spacing = width / count

  for (let i = 0; i < count; i++) {
    const x1 = i * spacing
    const x2 = x1 + spacing * 0.8

    // Add some variation to make it more realistic
    const offset = Math.sin(i * 0.1) * 50
    const scale = 0.8 + Math.random() * 0.4

    features.push({
      p11: { offsetPx: x1 },
      p12: { offsetPx: x2 },
      p21: { offsetPx: x1 * scale + offset },
      p22: { offsetPx: x2 * scale + offset },
      f: {
        get: (key: string) => {
          if (key === 'strand') {
            return Math.random() > 0.5 ? 1 : -1
          }
          return `chr${(i % 5) + 1}`
        },
        id: () => `feat_${i}`,
      } as any,
      cigar: [],
    })
  }

  return features
}

/**
 * Benchmark Canvas 2D rendering (simulated - actual implementation uses drawSynteny.ts)
 */
function benchmarkCanvas2D(
  canvas: HTMLCanvasElement,
  features: FeatPos[],
  height: number,
  drawCurves: boolean,
): { buildTimeMs: number; renderTimeMs: number; pickTimeMs: number } {
  const ctx = canvas.getContext('2d')!
  const offsets = [0, 0]
  const level = 0
  const alpha = 0.5

  // Measure build time (preparing data)
  const buildStart = performance.now()
  // Canvas 2D doesn't need separate build step - geometry is drawn directly
  const buildTimeMs = performance.now() - buildStart

  // Measure render time
  const renderStart = performance.now()

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (const feat of features) {
    const { p11, p12, p21, p22, f } = feat
    const x11 = p11.offsetPx - offsets[level]!
    const x12 = p12.offsetPx - offsets[level]!
    const x21 = p21.offsetPx - offsets[level + 1]!
    const x22 = p22.offsetPx - offsets[level + 1]!
    const strand = f.get('strand')

    ctx.fillStyle =
      strand === -1 ? `rgba(51, 51, 204, ${alpha})` : `rgba(204, 51, 51, ${alpha})`

    ctx.beginPath()
    if (drawCurves) {
      const mid = height / 2
      ctx.moveTo(x11, 0)
      ctx.lineTo(x12, 0)
      ctx.bezierCurveTo(x12, mid, x22, mid, x22, height)
      ctx.lineTo(x21, height)
      ctx.bezierCurveTo(x21, mid, x11, mid, x11, 0)
    } else {
      ctx.moveTo(x11, 0)
      ctx.lineTo(x12, 0)
      ctx.lineTo(x22, height)
      ctx.lineTo(x21, height)
    }
    ctx.closePath()
    ctx.fill()
  }

  const renderTimeMs = performance.now() - renderStart

  // Measure pick time (getImageData)
  const pickStart = performance.now()
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * canvas.width
    const y = Math.random() * canvas.height
    ctx.getImageData(x, y, 1, 1)
  }
  const pickTimeMs = (performance.now() - pickStart) / 100 // Per-pick average

  return { buildTimeMs, renderTimeMs, pickTimeMs }
}

/**
 * Benchmark WebGL rendering
 */
function benchmarkWebGL(
  canvas: HTMLCanvasElement,
  features: FeatPos[],
  height: number,
  drawCurves: boolean,
): {
  buildTimeMs: number
  renderTimeMs: number
  pickTimeMs: number
  triangleCount: number
} {
  const renderer = new SyntenyWebGLRenderer()

  if (!renderer.init(canvas)) {
    throw new Error('WebGL2 not supported')
  }

  const colorFn = createColorFunction('strand')
  const offsets = [0, 0]
  const level = 0
  const alpha = 0.5

  // Measure build time (geometry creation + upload)
  const buildStart = performance.now()
  renderer.buildGeometry(features, offsets, level, height, alpha, colorFn, drawCurves)
  const buildTimeMs = performance.now() - buildStart

  // Measure render time
  const renderStart = performance.now()
  renderer.render()
  renderer.renderPicking()
  const renderTimeMs = performance.now() - renderStart

  // Measure pick time
  const pickStart = performance.now()
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * canvas.width
    const y = Math.random() * canvas.height
    renderer.pick(x, y)
  }
  const pickTimeMs = (performance.now() - pickStart) / 100 // Per-pick average

  // Calculate triangle count
  const trianglesPerFeature = drawCurves ? 8 * 2 : 2 // 8 segments * 2 triangles for curves
  const triangleCount = features.length * trianglesPerFeature

  renderer.dispose()

  return { buildTimeMs, renderTimeMs, pickTimeMs, triangleCount }
}

/**
 * Run benchmarks
 */
export function runBenchmarks(): BenchmarkResult[] {
  const results: BenchmarkResult[] = []
  const width = 2000
  const height = 300

  const featureCounts = [100, 500, 1000, 5000, 10000, 50000]

  for (const count of featureCounts) {
    const features = generateTestFeatures(count, width)

    // Canvas 2D - straight lines
    const canvas2dStraight = document.createElement('canvas')
    canvas2dStraight.width = width
    canvas2dStraight.height = height
    const c2dStraight = benchmarkCanvas2D(canvas2dStraight, features, height, false)
    results.push({
      name: 'Canvas2D-Straight',
      featureCount: count,
      ...c2dStraight,
      totalTriangles: 0, // N/A for canvas
    })

    // Canvas 2D - bezier curves
    const canvas2dCurves = document.createElement('canvas')
    canvas2dCurves.width = width
    canvas2dCurves.height = height
    const c2dCurves = benchmarkCanvas2D(canvas2dCurves, features, height, true)
    results.push({
      name: 'Canvas2D-Bezier',
      featureCount: count,
      ...c2dCurves,
      totalTriangles: 0,
    })

    // WebGL - straight lines
    const webglStraight = document.createElement('canvas')
    webglStraight.width = width
    webglStraight.height = height
    try {
      const wglStraight = benchmarkWebGL(webglStraight, features, height, false)
      results.push({
        name: 'WebGL-Straight',
        featureCount: count,
        buildTimeMs: wglStraight.buildTimeMs,
        renderTimeMs: wglStraight.renderTimeMs,
        pickTimeMs: wglStraight.pickTimeMs,
        totalTriangles: wglStraight.triangleCount,
      })
    } catch (e) {
      console.log('WebGL not available for straight benchmark')
    }

    // WebGL - bezier curves
    const webglCurves = document.createElement('canvas')
    webglCurves.width = width
    webglCurves.height = height
    try {
      const wglCurves = benchmarkWebGL(webglCurves, features, height, true)
      results.push({
        name: 'WebGL-Bezier',
        featureCount: count,
        buildTimeMs: wglCurves.buildTimeMs,
        renderTimeMs: wglCurves.renderTimeMs,
        pickTimeMs: wglCurves.pickTimeMs,
        totalTriangles: wglCurves.triangleCount,
      })
    } catch (e) {
      console.log('WebGL not available for bezier benchmark')
    }
  }

  return results
}

/**
 * Format results as a table
 */
export function formatResults(results: BenchmarkResult[]): string {
  const lines: string[] = []

  lines.push(
    '| Renderer | Features | Build (ms) | Render (ms) | Pick (ms) | Triangles |',
  )
  lines.push(
    '|----------|----------|------------|-------------|-----------|-----------|',
  )

  for (const r of results) {
    lines.push(
      `| ${r.name.padEnd(16)} | ${r.featureCount.toString().padStart(6)} | ${r.buildTimeMs.toFixed(2).padStart(10)} | ${r.renderTimeMs.toFixed(2).padStart(11)} | ${r.pickTimeMs.toFixed(3).padStart(9)} | ${r.totalTriangles.toString().padStart(9)} |`,
    )
  }

  return lines.join('\n')
}

/**
 * Quick test function for browser console
 */
export function quickTest() {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 200

  const features = generateTestFeatures(1000, 800)
  const renderer = new SyntenyWebGLRenderer()

  if (!renderer.init(canvas)) {
    console.log('WebGL2 not available')
    return
  }

  const colorFn = createColorFunction('strand')
  renderer.buildGeometry(features, [0, 0], 0, 200, 0.5, colorFn, true)

  // Time multiple renders
  const iterations = 100
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    renderer.render()
  }
  const elapsed = performance.now() - start

  console.log(`Rendered ${iterations} frames in ${elapsed.toFixed(2)}ms`)
  console.log(`Average: ${(elapsed / iterations).toFixed(3)}ms per frame`)
  console.log(`FPS potential: ${(1000 / (elapsed / iterations)).toFixed(1)}`)

  // Test picking
  const pickStart = performance.now()
  renderer.renderPicking()
  for (let i = 0; i < 1000; i++) {
    renderer.pick(Math.random() * 800, Math.random() * 200)
  }
  const pickElapsed = performance.now() - pickStart
  console.log(`1000 picks in ${pickElapsed.toFixed(2)}ms (${(pickElapsed / 1000).toFixed(3)}ms each)`)

  renderer.dispose()

  // Append canvas to body for visual inspection
  document.body.appendChild(canvas)
  canvas.style.border = '1px solid black'

  // Re-init and render for display
  const displayRenderer = new SyntenyWebGLRenderer()
  displayRenderer.init(canvas)
  displayRenderer.buildGeometry(features, [0, 0], 0, 200, 0.5, colorFn, true)
  displayRenderer.render()

  return { canvas, renderer: displayRenderer }
}
