import { getContrastText } from '@jbrowse/core/ui/palette'
import {
  cssColorToABGR,
  cssColorToRgb,
  packAbgr,
} from '@jbrowse/core/util/colorBits'
import {
  MISSING_VALUE_COLOR,
  colorSchemes,
  createComparativeColorFunction,
} from '@jbrowse/synteny-core'

import {
  KIND_BASE_TILE,
  KIND_CIGAR_MIN,
  KIND_MARKER,
} from '../LinearSyntenyDisplay/shaders/syntenyTypes.generated.ts'

import type {
  AttributeRange,
  ColorFunctionInputs,
  RefNamePosition,
} from '@jbrowse/synteny-core'

// Per-instance kind tag. Determines how the color for an instance is derived
// from the parent feature's strand/refName/featureIdx and the current colorBy
// scheme. Emitted by the worker once during geometry build; colors are
// recomputed on the main thread whenever colorBy changes, so a color-scheme
// toggle never triggers an RPC refetch.
//
// The shaders only ever test BASE-vs-CIGAR (`isCigarKind`, i.e. kind >= the
// boundary) and marker-vs-not, so those two numbers are the shader's and are
// generated in (adr-051). The rest are numbered off the boundary here, which is
// what keeps the CIGAR kinds contiguous and above it by construction rather
// than by a comment asking for it.
export const KIND_BASE = 0
export { KIND_MARKER }
// One match segment of a tiled ribbon (transparent-indel mode). Colors as
// KIND_BASE — the `else` arm below is the one that paints both — and differs
// only in the renderers' sub-pixel width fade; see thinWidthFade.
export { KIND_BASE_TILE }
// Boundary only — the `isCigar = kind >= KIND_CIGAR_MATCH` threshold. Never
// emitted as an instance kind: buildSyntenyGeometry paints matches as
// KIND_BASE_TILE (transparent mode) or leaves them to the feature's base
// (colored mode).
export const KIND_CIGAR_MATCH = KIND_CIGAR_MIN
export const KIND_CIGAR_I = KIND_CIGAR_MIN + 1
export const KIND_CIGAR_D = KIND_CIGAR_MIN + 2
export const KIND_CIGAR_N = KIND_CIGAR_MIN + 3

// the kinds painted in their feature's own colour, so one transparent there is
// a ribbon the colour mode hides
export function paintsFeatureColor(kind: number) {
  return kind === KIND_BASE || kind === KIND_BASE_TILE
}

// Location-marker tick: the band's contrast ink at the alpha of the legacy
// rgba(0,0,0,0.25) context lines. Renderers draw KIND_MARKER instances as 1px
// lines using this packed alpha directly (no colorBy/global-alpha scaling).
//
// Contrast-derived rather than either black or a theme text colour: the band is
// an opaque KNOWN colour by construction (`syntenyGroundClear`), so a
// tick has to be legible against THAT and not against the page. Reading
// `text.secondary` while the band said something else is what shipped the
// off-screen-mate strip invisible.
const MARKER_ALPHA_BYTE = 64
function markerColor(groundColor: string) {
  const [r, g, b] = cssColorToRgb(getContrastText(groundColor))
  return packAbgr(r, g, b, MARKER_ALPHA_BYTE)
}

// And what "markers off" is: the same instance, painted to nothing. A zero alpha
// is below the `isInstanceInvisible` floor the Canvas2D draw loop and the pick
// engine share, so the tick is skipped outright there; on the GPU it rasterizes
// and blends nothing. That is the whole cost of keeping the toggle off the RPC —
// see `currentFetchKey` for what it buys, and MIN_MARKER_FEATURE_PX for why the
// count is small enough not to care (a whole-genome hairball emits no ticks at
// all).
const MARKER_COLOR_HIDDEN = packAbgr(0, 0, 0, 0)

// I/D/N indel colors for the active scheme (strand recolors N/D purple). Both
// schemes always define I/D/N, so these are unconditional.
function buildIndelColors(field: string) {
  const { cigarColors } =
    field === 'strand' ? colorSchemes.strand : colorSchemes.default
  return {
    I: cssColorToABGR(cigarColors.I),
    D: cssColorToABGR(cigarColors.D),
    N: cssColorToABGR(cigarColors.N),
  }
}

interface InstanceInputs {
  kinds: Uint8Array
  instanceFeatureIdx: Uint32Array
  instanceCount: number
}

// Pure function: produce a fresh Uint32Array of packed ABGR colors from
// per-instance descriptors plus per-feature data and the current color
// scheme. Called on the main thread whenever colorBy or featureData
// changes — no RPC round-trip.
export function computeSyntenyColors({
  instanceData,
  featureData,
  field,
  trackColor,
  valueColor,
  opacityByIdentity,
  drawLocationMarkers,
  groundColor,
  namePosition,
  attributeRanges,
  hideUnlabelled,
  hiddenFeatures,
}: {
  instanceData: InstanceInputs
  featureData: ColorFunctionInputs
  field: string
  // the display's slot in the view's track palette; only read under 'track'
  trackColor: string
  // the view's `colorBy.value`: what the match blocks paint under the default
  // mode in place of the red, when set
  valueColor?: string
  opacityByIdentity?: boolean
  // The location-marker toggle, which is a color decision rather than a fetch
  // one — the geometry always carries the ticks. Independent of colorBy: markers
  // are the ruler continued through the ribbons, not data, so no scheme paints
  // them and none of them can hide them either.
  drawLocationMarkers?: boolean
  // The band the ticks are drawn onto, which is what they have to contrast
  // against — see `bandGroundColor`.
  groundColor: string
  // See `createComparativeColorFunction`
  namePosition?: RefNamePosition
  // The domain a column's ramp scales to — the view's accumulated
  // one, not this fetch's. See `createComparativeColorFunction`.
  attributeRanges: Record<string, AttributeRange>
  hideUnlabelled?: boolean
  hiddenFeatures?: ReadonlySet<number>
}) {
  const { kinds, instanceFeatureIdx, instanceCount } = instanceData
  const colorFn = createComparativeColorFunction({
    field,
    data: featureData,
    trackColor,
    namePosition,
    attributeRanges,
    hideUnlabelled,
    defaultColor:
      valueColor === undefined
        ? MISSING_VALUE_COLOR
        : cssColorToABGR(valueColor),
  })
  const { I: colorI, D: colorD, N: colorN } = buildIndelColors(field)
  const marker = drawLocationMarkers
    ? markerColor(groundColor)
    : MARKER_COLOR_HIDDEN
  // identity fade is a separate channel from the color mode: a track can paint
  // by strand and still fade by identity, so this is read directly rather than
  // through the resolved mode
  const identities = featureData.attributes.identity
  const out = new Uint32Array(instanceCount)

  const indelColors: Record<number, number> = {
    [KIND_CIGAR_I]: colorI,
    [KIND_CIGAR_D]: colorD,
    [KIND_CIGAR_N]: colorN,
  }
  for (let i = 0; i < instanceCount; i++) {
    const kind = kinds[i]!
    const indelColor = indelColors[kind]
    if (kind === KIND_MARKER) {
      out[i] = marker
    } else if (indelColor !== undefined) {
      // an indel of a hidden ribbon goes with it
      const f = instanceFeatureIdx[i]!
      out[i] =
        hiddenFeatures?.has(f) || (hideUnlabelled && colorFn(f) >>> 24 === 0)
          ? 0
          : indelColor
    } else {
      const f = instanceFeatureIdx[i]!
      const base = hiddenFeatures?.has(f) ? 0 : colorFn(f)
      // a ribbon the colour mode hides stays hidden under the identity fade
      if (opacityByIdentity && base >>> 24 !== 0) {
        // Identity in [0,1] -> alpha byte in [0x4c, 0xff] (30% floor so
        // low-identity blocks remain perceptible). Unknown identity (NaN)
        // gets full alpha.
        const id = identities?.[f] ?? Number.NaN
        const alphaByte = Number.isNaN(id)
          ? 0xff
          : Math.max(0x4c, Math.round(id * 255))
        out[i] = (base & 0x00ffffff) | (alphaByte << 24)
      } else {
        out[i] = base
      }
    }
  }
  return out
}
