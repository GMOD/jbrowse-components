import type { ShaderModule } from '../../packages/render-core/src/slangPass.ts'

/** Premultiplied RGBA, each channel 0..1. */
export type Rgba = readonly [number, number, number, number]

export const CLEAR: Rgba = [0, 0, 0, 0]

export interface Texture {
  data: Uint8Array
  width: number
  height: number
}

/** What the harness reads at one sample, after the run at every dpr. */
export interface Budget {
  /** Largest per-pixel error, the worst channel's, 0..1. */
  max?: number
  /** Summed error over summed reference alpha. */
  meanErr?: number
  /** Pixels a translucent draw blended twice. */
  twice?: number
  /** Pixels inside the reference that a translucent draw left short. */
  holes?: number
}

export interface PixelFixture {
  name: string
  /** Repo-relative path of the pass's `.slang`, which `--base` reads at a git ref. */
  slang: string
  mod: ShaderModule
  /** CSS px; `width * dpr` and `height * dpr` should be whole. */
  width: number
  height: number
  dprs: readonly number[]
  count: number
  instances: () => ArrayBuffer
  uniforms: (dpr: number) => ArrayBuffer
  textures?: Record<string, Texture>
  /** The ideal scene's color at a CSS px point, which the harness supersamples. */
  reference: (x: number, y: number, dpr: number) => Rgba
  /** The alpha every mark draws at, for a fixture counting double blends. */
  translucent?: number
  budget?: Budget
  /** What the fixture shows, for the report. */
  about: string
}

interface PassModule<U, I> extends ShaderModule {
  writeUniforms: (buf: ArrayBuffer, uniforms: U) => void
  packInstances: (arrays: I, count: number) => ArrayBuffer
}

export function defineFixture<U, I>(f: {
  name: string
  slang: string
  about: string
  mod: PassModule<U, I>
  width: number
  height: number
  dprs?: readonly number[]
  count: number
  instances: I
  uniforms: (dpr: number) => U
  textures?: Record<string, Texture>
  reference: (x: number, y: number, dpr: number) => Rgba
  translucent?: number
  budget?: Budget
}): PixelFixture {
  const { mod } = f
  return {
    ...f,
    dprs: f.dprs ?? [1, 1.5, 2],
    instances: () => mod.packInstances(f.instances, f.count),
    uniforms: dpr => {
      const buf = new ArrayBuffer(Math.ceil(mod.UNIFORMS_SIZE_BYTES / 16) * 16)
      mod.writeUniforms(buf, f.uniforms(dpr))
      return buf
    },
  }
}

type Rgb = readonly [number, number, number]

/** An 8-bit color at alpha `a`, as the premultiplied reference color. */
export function rgba([r, g, b]: Rgb, a = 1): Rgba {
  return [(r / 255) * a, (g / 255) * a, (b / 255) * a, a]
}

/** An 8-bit color at alpha `a`, as the packed ABGR an instance carries. */
export function abgr([r, g, b]: Rgb, a = 1) {
  return ((Math.round(a * 255) << 24) | (b << 16) | (g << 8) | r) >>> 0
}

export interface Shape {
  inside: (x: number, y: number) => boolean
  color: Rgba
  /** [left, top, right, bottom] in CSS px, which lets a dense scene skip it. */
  bounds?: readonly [number, number, number, number]
}

const BUCKET_PX = 4

function over(out: Rgba, color: Rgba): Rgba {
  const k = 1 - color[3]
  return [
    color[0] + out[0] * k,
    color[1] + out[1] * k,
    color[2] + out[2] * k,
    color[3] + out[3] * k,
  ]
}

/** Shapes composited source-over in draw order. */
export function paintOver(shapes: readonly Shape[]) {
  if (shapes.some(s => !s.bounds)) {
    return (x: number, y: number) =>
      shapes.reduce(
        (out, s) => (s.inside(x, y) ? over(out, s.color) : out),
        CLEAR,
      )
  }
  const buckets = new Map<string, Shape[]>()
  for (const s of shapes) {
    const [l, t, r, b] = s.bounds!
    for (
      let i = Math.floor(l / BUCKET_PX);
      i <= Math.floor(r / BUCKET_PX);
      i++
    ) {
      for (
        let j = Math.floor(t / BUCKET_PX);
        j <= Math.floor(b / BUCKET_PX);
        j++
      ) {
        const key = `${i},${j}`
        const list = buckets.get(key)
        if (list) {
          list.push(s)
        } else {
          buckets.set(key, [s])
        }
      }
    }
  }
  return (x: number, y: number) =>
    (
      buckets.get(
        `${Math.floor(x / BUCKET_PX)},${Math.floor(y / BUCKET_PX)}`,
      ) ?? []
    ).reduce((out, s) => (s.inside(x, y) ? over(out, s.color) : out), CLEAR)
}

/** One color over the union of shapes: a stroke built of overlapping pieces. */
export function union(color: Rgba, inside: readonly Shape['inside'][]): Shape {
  return { color, inside: (x, y) => inside.some(f => f(x, y)) }
}

export function box(left: number, top: number, right: number, bottom: number) {
  return (x: number, y: number) =>
    x >= left && x < right && y >= top && y < bottom
}

export function boxShape(
  left: number,
  top: number,
  right: number,
  bottom: number,
  color: Rgba,
): Shape {
  return {
    inside: box(left, top, right, bottom),
    color,
    bounds: [left, top, right, bottom],
  }
}
