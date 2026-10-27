import { getContrastText } from '@jbrowse/core/ui/palette'
import {
  abgrAlpha,
  cssColorToABGR,
  cssColorToRgb,
  packAbgr,
  withAbgrAlpha,
} from '@jbrowse/core/util/colorBits'
import {
  DEFAULT_RIBBON_COLOR,
  colorSchemes,
  comparativeFilter,
  createComparativeColorFunction,
} from '@jbrowse/synteny-core'

import {
  KIND_CIGAR_I,
  KIND_CIGAR_D,
  KIND_CIGAR_N,
  KIND_MARKER,
} from '../LinearSyntenyRPC/syntenyKinds.ts'

import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type {
  AttributeRange,
  ColorFunctionInputs,
  FilterExtras,
  SyntenyColorPaint,
  RefNamePosition,
  SyntenyOpacitySnapshot,
} from '@jbrowse/synteny-core'

// Location-marker tick: the band's contrast ink at the alpha of the legacy
// rgba(0,0,0,0.25) context lines. Renderers draw KIND_MARKER instances as 1px
// lines using this packed alpha directly (no color or global-alpha scaling).
//
// Contrast-derived rather than either black or a theme text color: the band is
// an opaque KNOWN color by construction (`syntenyGroundClear`), so a
// tick has to be legible against THAT and not against the page. Reading
// `text.secondary` while the band said something else is what shipped the
// off-screen-mate strip invisible.
const MARKER_ALPHA_BYTE = 64
function markerColor(groundColor: string) {
  const [r, g, b] = cssColorToRgb(getContrastText(groundColor))
  return packAbgr(r, g, b, MARKER_ALPHA_BYTE)
}

// A tick painted to nothing: zero alpha is below the `isInstanceInvisible`
// floor the draw loops and the pick engine share, so the tick is skipped. The
// count is small (MIN_MARKER_FEATURE_PX), so keeping the toggle off the RPC
// costs little.
const MARKER_COLOR_HIDDEN = packAbgr(0, 0, 0, 0)

// I/D/N indel colors for the active scheme (strand recolors N/D purple). Both
// schemes always define I/D/N, so these are unconditional.
function buildIndelColors(field: string | undefined) {
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

/**
 * The view's ribbon color function: `createComparativeColorFunction` over
 * the match block's red, or the view's `color.value` where set.
 */
export function createSyntenyColorFunction({
  valueColor,
  ...args
}: Omit<
  Parameters<typeof createComparativeColorFunction>[0],
  'defaultColor'
> & {
  valueColor?: string
}) {
  return createComparativeColorFunction({
    ...args,
    defaultColor:
      valueColor === undefined
        ? DEFAULT_RIBBON_COLOR
        : cssColorToABGR(valueColor),
  })
}

// Pure function: produce a fresh Uint32Array of packed ABGR colors from
// per-instance descriptors plus per-feature data and the current color
// scheme. Called on the main thread whenever the color or featureData
// changes — no RPC round-trip.
export function computeSyntenyColors({
  instanceData,
  featureData,
  field,
  trackColor,
  valueColor,
  opacity,
  axisGrid,
  groundColor,
  namePosition,
  attributeRanges,
  filter,
  filterExtras,
  hiddenFeatures,
  paint,
}: {
  instanceData: InstanceInputs
  featureData: ColorFunctionInputs
  field: string | undefined
  // the display's slot in the view's track palette; only read under 'track'
  trackColor: string
  // the view's `color.value`: what the match blocks paint under the default
  // mode in place of the red, when set
  valueColor?: string
  // the view's `encoding.opacity`, whose field fades each ribbon and its indels
  opacity?: SyntenyOpacitySnapshot
  // `axis.grid`, a color decision since the geometry always carries the ticks.
  // A tick is the ruler continued through its ribbon, so no scheme paints it,
  // but it goes where its ribbon is filtered out or hidden.
  axisGrid?: boolean
  // The band the ticks are drawn onto, which is what they have to contrast
  // against — see `bandGroundColor`.
  groundColor: string
  // See `createComparativeColorFunction`
  namePosition?: RefNamePosition
  // The domain a column's ramp scales to — the view's accumulated
  // one, not this fetch's. See `createComparativeColorFunction`.
  attributeRanges: Record<string, AttributeRange>
  // the view's `filter`, which paints a ribbon it rejects at zero alpha
  filter?: readonly FieldPredicate[]
  filterExtras?: FilterExtras
  hiddenFeatures?: ReadonlySet<number>
  // what the view's `encoding.color.scale` declares over a field's own scale
  paint?: SyntenyColorPaint
}) {
  const { kinds, instanceFeatureIdx, instanceCount } = instanceData
  const colorFn = createSyntenyColorFunction({
    field,
    data: featureData,
    trackColor,
    namePosition,
    attributeRanges,
    paint,
    opacity,
    filter,
    filterExtras,
    valueColor,
  })
  const { I: colorI, D: colorD, N: colorN } = buildIndelColors(field)
  const marker = axisGrid ? markerColor(groundColor) : MARKER_COLOR_HIDDEN
  const passes = axisGrid
    ? comparativeFilter(filter, featureData, filterExtras)
    : undefined
  const out = new Uint32Array(instanceCount)

  const indelColors: Record<number, number> = {
    [KIND_CIGAR_I]: colorI,
    [KIND_CIGAR_D]: colorD,
    [KIND_CIGAR_N]: colorN,
  }
  for (let i = 0; i < instanceCount; i++) {
    const kind = kinds[i]!
    const indelColor = indelColors[kind]
    const f = instanceFeatureIdx[i]!
    if (kind === KIND_MARKER) {
      out[i] =
        hiddenFeatures?.has(f) || (passes && !passes(f))
          ? MARKER_COLOR_HIDDEN
          : marker
    } else {
      const base = hiddenFeatures?.has(f) ? 0 : colorFn(f)
      // an indel takes its ribbon's opacity: hidden with it, faded with it
      out[i] =
        indelColor === undefined || abgrAlpha(base) === 0
          ? base
          : withAbgrAlpha(
              indelColor,
              Math.round((abgrAlpha(indelColor) * abgrAlpha(base)) / 255),
            )
    }
  }
  return out
}
