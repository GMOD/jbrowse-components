import { COLOR_RAMP_LUT_ENTRIES } from '@jbrowse/render-core/colorRampLut'

import { cssColorToRgba } from './colorBits.ts'
import { DEFAULT_COLOR_SCHEME } from './colorSchemes.ts'

import type { RampStop } from '../ui/colorScale.ts'
import type { ColorSchemeName } from './colorSchemes.ts'

/** One evenly-spaced ramp stop: 8-bit red, green, blue, alpha. */
export type ColorRampStop = readonly [number, number, number, number]

const VIRIDIS_HEX_SPEC =
  '44015444025645045745055946075a46085c460a5d460b5e470d60470e6147106347116447136548146748166848176948186a481a6c481b6d481c6e481d6f481f70482071482173482374482475482576482677482878482979472a7a472c7a472d7b472e7c472f7d46307e46327e46337f463480453581453781453882443983443a83443b84433d84433e85423f854240864241864142874144874045884046883f47883f48893e49893e4a893e4c8a3d4d8a3d4e8a3c4f8a3c508b3b518b3b528b3a538b3a548c39558c39568c38588c38598c375a8c375b8d365c8d365d8d355e8d355f8d34608d34618d33628d33638d32648e32658e31668e31678e31688e30698e306a8e2f6b8e2f6c8e2e6d8e2e6e8e2e6f8e2d708e2d718e2c718e2c728e2c738e2b748e2b758e2a768e2a778e2a788e29798e297a8e297b8e287c8e287d8e277e8e277f8e27808e26818e26828e26828e25838e25848e25858e24868e24878e23888e23898e238a8d228b8d228c8d228d8d218e8d218f8d21908d21918c20928c20928c20938c1f948c1f958b1f968b1f978b1f988b1f998a1f9a8a1e9b8a1e9c891e9d891f9e891f9f881fa0881fa1881fa1871fa28720a38620a48621a58521a68522a78522a88423a98324aa8325ab8225ac8226ad8127ad8128ae8029af7f2ab07f2cb17e2db27d2eb37c2fb47c31b57b32b67a34b67935b77937b87838b9773aba763bbb753dbc743fbc7340bd7242be7144bf7046c06f48c16e4ac16d4cc26c4ec36b50c46a52c56954c56856c66758c7655ac8645cc8635ec96260ca6063cb5f65cb5e67cc5c69cd5b6ccd5a6ece5870cf5773d05675d05477d1537ad1517cd2507fd34e81d34d84d44b86d54989d5488bd6468ed64590d74393d74195d84098d83e9bd93c9dd93ba0da39a2da37a5db36a8db34aadc32addc30b0dd2fb2dd2db5de2bb8de29bade28bddf26c0df25c2df23c5e021c8e020cae11fcde11dd0e11cd2e21bd5e21ad8e219dae319dde318dfe318e2e418e5e419e7e419eae51aece51befe51cf1e51df4e61ef6e620f8e621fbe723fde725'

function stopsFromHex(spec: string): ColorRampStop[] {
  const out: ColorRampStop[] = []
  for (let i = 0; i < spec.length; i += 6) {
    out.push([
      Number.parseInt(spec.slice(i, i + 2), 16),
      Number.parseInt(spec.slice(i + 2, i + 4), 16),
      Number.parseInt(spec.slice(i + 4, i + 6), 16),
      255,
    ])
  }
  return out
}

/**
 * #api
 * The 256 viridis stops, fully opaque. Feed them to {@link buildColorRampLut}
 * for the texture/fillStyle form, or to {@link sampleColorRamp} for legend
 * stops.
 */
export const VIRIDIS_STOPS: readonly ColorRampStop[] =
  stopsFromHex(VIRIDIS_HEX_SPEC)

const MAGMA_HEX_SPEC =
  '00000401000501010601010802010902020b02020d03030f03031204041405041606051806051a07061c08071e0907200a08220b09240c09260d0a290e0b2b100b2d110c2f120d31130d34140e36150e38160f3b180f3d19103f1a10421c10441d11471e114920114b21114e22115024125325125527125829115a2a115c2c115f2d11612f116331116533106734106936106b38106c390f6e3b0f703d0f713f0f72400f74420f75440f764510774710784910784a10794c117a4e117b4f127b51127c52137c54137d56147d57157e59157e5a167e5c167f5d177f5f187f601880621980641a80651a80671b80681c816a1c816b1d816d1d816e1e81701f81721f817320817521817621817822817922827b23827c23827e24828025828125818326818426818627818827818928818b29818c29818e2a81902a81912b81932b80942c80962c80982d80992d809b2e7f9c2e7f9e2f7fa02f7fa1307ea3307ea5317ea6317da8327daa337dab337cad347cae347bb0357bb2357bb3367ab5367ab73779b83779ba3878bc3978bd3977bf3a77c03a76c23b75c43c75c53c74c73d73c83e73ca3e72cc3f71cd4071cf4070d0416fd2426fd3436ed5446dd6456cd8456cd9466bdb476adc4869de4968df4a68e04c67e24d66e34e65e44f64e55064e75263e85362e95462ea5661eb5760ec5860ed5a5fee5b5eef5d5ef05f5ef1605df2625df2645cf3655cf4675cf4695cf56b5cf66c5cf66e5cf7705cf7725cf8745cf8765cf9785df9795df97b5dfa7d5efa7f5efa815ffb835ffb8560fb8761fc8961fc8a62fc8c63fc8e64fc9065fd9266fd9467fd9668fd9869fd9a6afd9b6bfe9d6cfe9f6dfea16efea36ffea571fea772fea973feaa74feac76feae77feb078feb27afeb47bfeb67cfeb77efeb97ffebb81febd82febf84fec185fec287fec488fec68afec88cfeca8dfecc8ffecd90fecf92fed194fed395fed597fed799fed89afdda9cfddc9efddea0fde0a1fde2a3fde3a5fde5a7fde7a9fde9aafdebacfcecaefceeb0fcf0b2fcf2b4fcf4b6fcf6b8fcf7b9fcf9bbfcfbbdfcfdbf'

const INFERNO_HEX_SPEC =
  '00000401000501010601010802010a02020c02020e03021004031204031405041706041907051b08051d09061f0a07220b07240c08260d08290e092b10092d110a30120a32140b34150b37160b39180c3c190c3e1b0c411c0c431e0c451f0c48210c4a230c4c240c4f260c51280b53290b552b0b572d0b592f0a5b310a5c320a5e340a5f3609613809623909633b09643d09653e0966400a67420a68440a68450a69470b6a490b6a4a0c6b4c0c6b4d0d6c4f0d6c510e6c520e6d540f6d550f6d57106e59106e5a116e5c126e5d126e5f136e61136e62146e64156e65156e67166e69166e6a176e6c186e6d186e6f196e71196e721a6e741a6e751b6e771c6d781c6d7a1d6d7c1d6d7d1e6d7f1e6c801f6c82206c84206b85216b87216b88226a8a226a8c23698d23698f24699025689225689326679526679727669827669a28659b29649d29649f2a63a02a63a22b62a32c61a52c60a62d60a82e5fa92e5eab2f5ead305dae305cb0315bb1325ab3325ab43359b63458b73557b93556ba3655bc3754bd3853bf3952c03a51c13a50c33b4fc43c4ec63d4dc73e4cc83f4bca404acb4149cc4248ce4347cf4446d04545d24644d34743d44842d54a41d74b3fd84c3ed94d3dda4e3cdb503bdd513ade5238df5337e05536e15635e25734e35933e45a31e55c30e65d2fe75e2ee8602de9612bea632aeb6429eb6628ec6726ed6925ee6a24ef6c23ef6e21f06f20f1711ff1731df2741cf3761bf37819f47918f57b17f57d15f67e14f68013f78212f78410f8850ff8870ef8890cf98b0bf98c0af98e09fa9008fa9207fa9407fb9606fb9706fb9906fb9b06fb9d07fc9f07fca108fca309fca50afca60cfca80dfcaa0ffcac11fcae12fcb014fcb216fcb418fbb61afbb81dfbba1ffbbc21fbbe23fac026fac228fac42afac62df9c72ff9c932f9cb35f8cd37f8cf3af7d13df7d340f6d543f6d746f5d949f5db4cf4dd4ff4df53f4e156f3e35af3e55df2e661f2e865f2ea69f1ec6df1ed71f1ef75f1f179f2f27df2f482f3f586f3f68af4f88ef5f992f6fa96f8fb9af9fc9dfafda1fcffa4'

const CIVIDIS_HEX_SPEC =
  '00224e00234f00245100255300255400265600275800285900285b00295d002a5f002a61002b62002c64002c66002d68002e6a002e6c002f6d00306f0030700031700031710132710533710833700c34700f357012357014367016377018376f1a386f1c396f1e3a6f203a6f213b6e233c6e243c6e263d6e273e6e293f6e2a3f6d2b406d2d416d2e416d2f426d31436d32436d33446d34456c35456c36466c38476c39486c3a486c3b496c3c4a6c3d4a6c3e4b6c3f4c6c404c6c414d6c424e6c434e6c444f6c45506c46516c47516c48526c49536c4a536c4b546c4c556c4d556c4e566c4f576c50576c51586d52596d535a6d545a6d555b6d555c6d565c6d575d6d585e6d595e6e5a5f6e5b606e5c616e5d616e5e626e5e636f5f636f60646f61656f62656f636670646770656870656870666970676a71686a71696b716a6c716b6d726c6d726c6e726d6f726e6f736f70737071737172747272747273747374757474757575757676767777767777777878777979777a7a787b7a787c7b787d7c787e7c787e7d787f7e78807f78817f788280798381798482798582798683798784788885788985788a86788b87788c88788d88788e89788f8a78908b78918b78928c78928d78938e78948e77958f779690779791779892779992779a93769b94769c95769d95769e96769f9775a09875a19975a29975a39a74a49b74a59c74a69c74a79d73a89e73a99f73aaa073aba072aca172ada272aea371afa471b0a571b1a570b3a670b4a76fb5a86fb6a96fb7a96eb8aa6eb9ab6dbaac6dbbad6dbcae6cbdae6cbeaf6bbfb06bc0b16ac1b26ac2b369c3b369c4b468c5b568c6b667c7b767c8b866c9b965cbb965ccba64cdbb63cebc63cfbd62d0be62d1bf61d2c060d3c05fd4c15fd5c25ed6c35dd7c45cd9c55cdac65bdbc75adcc859ddc858dec958dfca57e0cb56e1cc55e2cd54e4ce53e5cf52e6d051e7d150e8d24fe9d34eead34cebd44bedd54aeed649efd748f0d846f1d945f2da44f3db42f5dc41f6dd3ff7de3ef8df3cf9e03afbe138fce236fde334fee434fee535fee636fee838'

const FALL_STOPS: readonly ColorRampStop[] = [
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
]

const JUICEBOX_STOPS: readonly ColorRampStop[] = [
  [255, 0, 0, 0],
  [255, 0, 0, 255],
]

const REDS_STOPS: readonly ColorRampStop[] = [
  [255, 245, 240, 255],
  [254, 224, 210, 255],
  [252, 187, 161, 255],
  [252, 146, 114, 255],
  [251, 106, 74, 255],
  [239, 59, 44, 255],
  [203, 24, 29, 255],
  [165, 15, 21, 255],
  [103, 0, 13, 255],
]

const BLUES_STOPS: readonly ColorRampStop[] = [
  [247, 251, 255, 255],
  [222, 235, 247, 255],
  [198, 219, 239, 255],
  [158, 202, 225, 255],
  [107, 174, 214, 255],
  [66, 146, 198, 255],
  [33, 113, 181, 255],
  [8, 81, 156, 255],
  [8, 48, 107, 255],
]

const REDBLUE_STOPS: readonly ColorRampStop[] = [
  [103, 0, 31, 255],
  [178, 24, 43, 255],
  [214, 96, 77, 255],
  [244, 165, 130, 255],
  [253, 219, 199, 255],
  [247, 247, 247, 255],
  [209, 229, 240, 255],
  [146, 197, 222, 255],
  [67, 147, 195, 255],
  [33, 102, 172, 255],
  [5, 48, 97, 255],
]

const PURPLEORANGE_STOPS: readonly ColorRampStop[] = [
  [45, 0, 75, 255],
  [84, 39, 136, 255],
  [128, 115, 172, 255],
  [178, 171, 210, 255],
  [216, 218, 235, 255],
  [247, 247, 247, 255],
  [254, 224, 182, 255],
  [253, 184, 99, 255],
  [224, 130, 20, 255],
  [179, 88, 6, 255],
  [127, 59, 8, 255],
]

const SCHEME_STOPS: Record<ColorSchemeName, readonly ColorRampStop[]> = {
  viridis: VIRIDIS_STOPS,
  juicebox: JUICEBOX_STOPS,
  fall: FALL_STOPS,
  reds: REDS_STOPS,
  blues: BLUES_STOPS,
  magma: stopsFromHex(MAGMA_HEX_SPEC),
  inferno: stopsFromHex(INFERNO_HEX_SPEC),
  cividis: stopsFromHex(CIVIDIS_HEX_SPEC),
  redblue: REDBLUE_STOPS,
  purpleorange: PURPLEORANGE_STOPS,
}

function luminanceOverWhite([r, g, b, a]: ColorRampStop) {
  const over = (c: number) => 255 + (c - 255) * (a / 255)
  return 0.2126 * over(r) + 0.7152 * over(g) + 0.0722 * over(b)
}

/**
 * #api
 * Whether a named ramp runs dark at its low end, drawn over white: viridis
 * and its siblings do, juicebox, fall, reds and blues do not.
 */
export function darkAtLowEnd(scheme: ColorSchemeName) {
  const stops = SCHEME_STOPS[scheme]
  return luminanceOverWhite(stops[0]!) < luminanceOverWhite(stops.at(-1)!)
}

const EMPTY_EXTENT_DOMAIN = [0, 1] as const

/**
 * #api
 * The domain a continuous colour scale spans: each end `min` or `max` pins,
 * else the extent's, ascending, since a span has no direction and `reverse`
 * is the ramp's. An open end stops at a pinned one rather than crossing it,
 * and an extent holding no value (`[Infinity, -Infinity]`) spans [0, 1].
 */
export function rampDomain(
  min: number | undefined,
  max: number | undefined,
  extent: readonly [number, number],
): [number, number] {
  const [lo, hi] = extent[0] <= extent[1] ? extent : EMPTY_EXTENT_DOMAIN
  if (min !== undefined && max !== undefined) {
    return min <= max ? [min, max] : [max, min]
  }
  if (min !== undefined) {
    return [min, Math.max(min, hi)]
  }
  if (max !== undefined) {
    return [Math.min(lo, max), max]
  }
  return [lo, hi]
}

/**
 * #api
 * The stops a continuous colour scale samples: `range`'s CSS colours where it
 * lists any, else the named `scheme`, viridis while that is unset, turned
 * round under `reverse`.
 */
export function colorRampStops({
  range,
  scheme,
  reverse,
}: RampDeclaration): readonly ColorRampStop[] {
  const stops = range?.length
    ? range.map(c => cssColorToRgba(c))
    : SCHEME_STOPS[scheme ?? DEFAULT_COLOR_SCHEME]
  return reverse ? stops.toReversed() : stops
}

function lerp8(a: number, b: number, t: number) {
  return Math.round(a * (1 - t) + b * t)
}

/**
 * #api
 * The color at `t` in `[0, 1]` across a list of EVENLY SPACED stops, linearly
 * interpolated per channel. `t` is clamped, so the ends are the end stops
 * rather than an extrapolation past them, and a one-stop ramp is that stop
 * everywhere.
 */
export function sampleColorRamp(stops: readonly ColorRampStop[], t: number) {
  const position = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const lower = Math.floor(position)
  const lo = stops[lower]!
  const hi = stops[Math.min(lower + 1, stops.length - 1)]!
  const frac = position - lower
  return [
    lerp8(lo[0], hi[0], frac),
    lerp8(lo[1], hi[1], frac),
    lerp8(lo[2], hi[2], frac),
    lerp8(lo[3], hi[3], frac),
  ] as ColorRampStop
}

/**
 * #api
 * An RGBA lookup table over {@link sampleColorRamp}, laid out as the Nx1
 * texture both GPU backends upload and the Canvas2D twins index — entry `i` is
 * the color at `t = i / (N - 1)`. N comes off the shader that samples it, so
 * the table and `rampColor`'s texel mapping cannot disagree.
 *
 * `mid` is where the stop list's own midpoint lands in the table, so a
 * diverging ramp whose middle colour belongs at a value off the centre of the
 * domain is baked into the bytes. Every reader — the shader, the Canvas2D
 * fillStyle table, the legend bar — then samples one evenly spaced table and
 * cannot disagree about the warp.
 */
export function buildColorRampLut(stops: readonly ColorRampStop[], mid = 0.5) {
  const last = COLOR_RAMP_LUT_ENTRIES - 1
  const data = new Uint8Array(COLOR_RAMP_LUT_ENTRIES * 4)
  const m = Math.min(1, Math.max(0, mid))
  for (let i = 0; i < COLOR_RAMP_LUT_ENTRIES; i++) {
    const t = i / last
    const [r, g, b, a] = sampleColorRamp(stops, unwarp(t, m))
    data[i * 4] = r
    data[i * 4 + 1] = g
    data[i * 4 + 2] = b
    data[i * 4 + 3] = a
  }
  return data
}

function unwarp(t: number, mid: number) {
  if (mid <= 0) {
    return t >= 1 ? 1 : 0.5 + 0.5 * t
  }
  if (mid >= 1) {
    return t <= 0 ? 0 : 0.5 * t
  }
  return t <= mid ? (0.5 * t) / mid : 0.5 + (0.5 * (t - mid)) / (1 - mid)
}

/**
 * #api
 * A continuous colour scale's ramp as a config declares it.
 */
export interface RampDeclaration {
  range?: readonly string[]
  scheme?: ColorSchemeName
  reverse?: boolean
}

const MAX_RAMP_LUTS = 32
const luts = new Map<string, Uint8Array>()

/**
 * #api
 * The {@link buildColorRampLut} table a ramp declaration asks for, the same
 * `Uint8Array` for the same declaration, since a GPU backend re-uploads its
 * ramp texture when the identity changes and a render state is rebuilt far
 * more often than its ramp.
 */
export function rampLutOf(ramp: RampDeclaration): Uint8Array {
  const key = [ramp.scheme ?? '', ramp.range?.join(' ') ?? '', !!ramp.reverse]
    .map(String)
    .join('|')
  let lut = luts.get(key)
  if (!lut) {
    if (luts.size >= MAX_RAMP_LUTS) {
      luts.delete(luts.keys().next().value!)
    }
    lut = buildColorRampLut(colorRampStops(ramp))
    luts.set(key, lut)
  }
  return lut
}

/**
 * #api
 * `n` evenly spaced legend stops read straight out of a
 * {@link buildColorRampLut} byte table — the same 256×1 RGBA array
 * `uploadColorRampLut` hands the GPU and the Canvas2D fillStyle LUTs index —
 * as the stops of a `RampScale`. It holds one claim by construction: the
 * swatch at bar fraction `t` is byte-identical to the ramp entry at `t` on
 * both backends. Alpha rides `opacity` (the juicebox fade), never baked into
 * the color string.
 */
export function stopsFromRampLut(lut: Uint8Array, n: number): RampStop[] {
  const lastEntry = lut.length / 4 - 1
  const out: RampStop[] = []
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : i / (n - 1)
    const o = Math.round(t * lastEntry) * 4
    out.push({
      offset: t,
      color: `rgb(${lut[o]!},${lut[o + 1]!},${lut[o + 2]!})`,
      opacity: lut[o + 3]! / 255,
    })
  }
  return out
}
