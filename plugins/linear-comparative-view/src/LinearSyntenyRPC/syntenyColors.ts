import { cssColorToABGR, packAbgr } from '@jbrowse/core/util/colorBits'
import {
  MISSING_VALUE_COLOR,
  colorSchemes,
  createComparativeColorFunction,
} from '@jbrowse/synteny-core'

import {
  KIND_CIGAR_MIN,
  KIND_MARKER,
} from '../LinearSyntenyDisplay/shaders/syntenyTypes.generated.ts'

import type { ColorFunctionInputs, SyntenyColorBy } from '@jbrowse/synteny-core'

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
// Boundary only — the `isCigar = kind >= KIND_CIGAR_MATCH` threshold. Never
// emitted as an instance kind: buildSyntenyGeometry paints matches as KIND_BASE
// (transparent mode) or leaves them to the pass-1 base (colored mode).
export const KIND_CIGAR_MATCH = KIND_CIGAR_MIN
export const KIND_CIGAR_I = KIND_CIGAR_MIN + 1
export const KIND_CIGAR_D = KIND_CIGAR_MIN + 2
export const KIND_CIGAR_N = KIND_CIGAR_MIN + 3

// Location-marker tick: semi-transparent black, matching the legacy
// rgba(0,0,0,0.25) context lines. Renderers draw KIND_MARKER instances as 1px
// lines using this packed alpha directly (no colorBy/global-alpha scaling).
const MARKER_COLOR = packAbgr(0, 0, 0, 64)

// I/D/N indel colors for the active scheme (strand recolors N/D purple). Both
// schemes always define I/D/N, so these are unconditional.
function buildIndelColors(colorBy: SyntenyColorBy) {
  const { cigarColors } =
    colorBy === 'strand' ? colorSchemes.strand : colorSchemes.default
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
  colorBy,
  trackColor,
  opacityByIdentity,
  nameOrder,
}: {
  instanceData: InstanceInputs
  featureData: ColorFunctionInputs
  colorBy: SyntenyColorBy
  // the display's slot in the view's track palette; only read by colorBy:'track'
  trackColor: string
  opacityByIdentity?: boolean
  // Chromosome order of the assembly the chromosome-painting modes key on, so a
  // ribbon's color can be that chromosome's position rather than a hash bucket.
  // Only the display knows it — the assembly's refName list is a session fact,
  // not something in the feature data — so it is passed in rather than derived.
  nameOrder?: readonly string[]
}) {
  const { kinds, instanceFeatureIdx, instanceCount } = instanceData
  const colorFn = createComparativeColorFunction({
    colorBy,
    data: featureData,
    trackColor,
    nameOrder,
    // a ribbon's unpainted state is the red match block
    defaultColor: MISSING_VALUE_COLOR,
  })
  const { I: colorI, D: colorD, N: colorN } = buildIndelColors(colorBy)
  // identity fade is a separate channel from the color mode: a track can paint
  // by strand and still fade by identity, so this is read directly rather than
  // through the resolved mode
  const identities = featureData.attributes.identity
  const out = new Uint32Array(instanceCount)

  for (let i = 0; i < instanceCount; i++) {
    const kind = kinds[i]!
    if (kind === KIND_MARKER) {
      out[i] = MARKER_COLOR
    } else if (kind === KIND_CIGAR_I) {
      out[i] = colorI
    } else if (kind === KIND_CIGAR_D) {
      out[i] = colorD
    } else if (kind === KIND_CIGAR_N) {
      out[i] = colorN
    } else {
      const f = instanceFeatureIdx[i]!
      const base = colorFn(f)
      if (opacityByIdentity) {
        // Identity in [0,1] -> alpha byte in [0x4c, 0xff] (30% floor so
        // low-identity blocks remain perceptible). Unknown identity (-1)
        // gets full alpha.
        const id = identities?.[f] ?? -1
        const alphaByte = id < 0 ? 0xff : Math.max(0x4c, Math.round(id * 255))
        out[i] = (base & 0x00ffffff) | (alphaByte << 24)
      } else {
        out[i] = base
      }
    }
  }
  return out
}
