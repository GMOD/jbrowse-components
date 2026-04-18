// Linear (non-log) Hi-C color scaling divides max by this so most cells aren't
// saturated to the top of the ramp. Mirrored as a literal in hic.slang's
// fragment shader — keep in sync.
export const HIC_LINEAR_SCORE_DIVISOR = 20

export type RGBA = readonly [number, number, number, number]

// Single source of truth for each scheme. Used to build the GPU/Canvas2D
// 256x1 RGBA ramp AND the CSS/SVG legend gradients. Stops are evenly spaced
// unless an explicit `offset` (0..1) is provided.
interface ColorStops {
  stops: readonly RGBA[]
  offsets?: readonly number[]
}

const FALL_STOPS: ColorStops = {
  stops: [
    [255, 255, 255, 255],
    [255, 255, 204, 255],
    [255, 237, 160, 255],
    [254, 217, 118, 255],
    [254, 178, 76, 255],
    [253, 141, 60, 255],
    [252, 78, 42, 255],
    [227, 26, 28, 255],
    [189, 0, 38, 255],
    [128, 0, 38, 255],
    [0, 0, 0, 255],
  ],
}

const JUICEBOX_STOPS: ColorStops = {
  stops: [
    [255, 0, 0, 0],
    [255, 0, 0, 255],
  ],
}

// Viridis full 256-color hex spec — kept for the GPU ramp so the heatmap has
// the smooth perceptually-uniform gradient. Legends use a 10-stop subset
// derived by sampling, so the legend visually matches the heatmap.
const VIRIDIS_HEX_SPEC =
  '44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725'

function viridisRgbaFromHex(): RGBA[] {
  const out: RGBA[] = []
  for (let i = 0; i < 256; i++) {
    const hex = VIRIDIS_HEX_SPEC.slice(i * 6, i * 6 + 6)
    out.push([
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      255,
    ])
  }
  return out
}

const VIRIDIS_FULL_STOPS: ColorStops = { stops: viridisRgbaFromHex() }

const SCHEMES: Record<string, ColorStops> = {
  fall: FALL_STOPS,
  juicebox: JUICEBOX_STOPS,
  viridis: VIRIDIS_FULL_STOPS,
}

function getScheme(name?: string) {
  return SCHEMES[name ?? 'juicebox'] ?? JUICEBOX_STOPS
}

function offsetAt(scheme: ColorStops, i: number) {
  return scheme.offsets?.[i] ?? i / (scheme.stops.length - 1)
}

function lerp(a: number, b: number, t: number) {
  return a * (1 - t) + b * t
}

function sample(scheme: ColorStops, t: number): RGBA {
  const stops = scheme.stops
  if (stops.length === 1) {
    return stops[0]!
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const lo = offsetAt(scheme, i)
    const hi = offsetAt(scheme, i + 1)
    if (t <= hi) {
      const f = hi === lo ? 0 : (t - lo) / (hi - lo)
      const a = stops[i]!
      const b = stops[i + 1]!
      return [
        Math.round(lerp(a[0], b[0], f)),
        Math.round(lerp(a[1], b[1], f)),
        Math.round(lerp(a[2], b[2], f)),
        Math.round(lerp(a[3], b[3], f)),
      ]
    }
  }
  return stops[stops.length - 1]!
}

export function generateColorRamp(colorScheme?: string): Uint8Array {
  const scheme = getScheme(colorScheme)
  const data = new Uint8Array(256 * 4)
  for (let i = 0; i < 256; i++) {
    const t = i / 255
    const [r, g, b, a] = sample(scheme, t)
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = a
  }
  return data
}

// Sample N evenly-spaced legend stops from the same source as the GPU ramp.
export function getLegendStops(colorScheme: string | undefined, n = 11) {
  const scheme = getScheme(colorScheme)
  const out: { offset: number; rgba: RGBA }[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    out.push({ offset: t, rgba: sample(scheme, t) })
  }
  return out
}

function rgbaCss([r, g, b, a]: RGBA) {
  return `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`
}

export function getLegendCssGradient(colorScheme: string | undefined) {
  const stops = getLegendStops(colorScheme)
  const parts = stops.map(s => `${rgbaCss(s.rgba)} ${(s.offset * 100).toFixed(0)}%`)
  return `linear-gradient(to right, ${parts.join(', ')})`
}

export function getLegendSvgStops(colorScheme: string | undefined) {
  const stops = getLegendStops(colorScheme)
  return stops.map(s => ({
    offset: `${(s.offset * 100).toFixed(0)}%`,
    color: rgbaCss(s.rgba),
  }))
}

export {
  lookupColorRamp,
  lookupColorRampCSS,
} from '@jbrowse/core/gpu/canvas2dUtils'

// Map a contact count into [0, 1] for color-ramp sampling. Mirrors the logic
// in hic.slang's fragment shader so Canvas2D + SVG rendering stay consistent
// with the GPU path.
export function mapHicCount(
  count: number,
  maxScore: number,
  useLogScale: boolean,
) {
  const m = useLogScale ? maxScore : maxScore / HIC_LINEAR_SCORE_DIVISOR
  const t = useLogScale
    ? Math.log2(Math.max(count, 1)) / Math.log2(Math.max(m, 1))
    : count / Math.max(m, 0.001)
  return Math.max(0, Math.min(1, t))
}
