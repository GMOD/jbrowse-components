import { max, toLocale } from '@jbrowse/core/util'

import type { Slice, SliceRegion } from './slices.ts'

// The label geometry `Ruler.tsx` draws with, kept here rather than there so the
// SVG export can measure a figure without importing a component module (which
// react-refresh requires stay component-only).
export const labelFontSizePx = 13

// how far outside the ruler arc a label is anchored
export const labelOffsetPx = 5

// rough advance width of one character at `labelFontSizePx`. Only ever used to
// compare a label against the arc it would sit on, so an estimate is enough —
// but it has to be *one* estimate, since the fit test and the room reserved for
// the labels that fail it must agree.
const charWidthPx = 6.5

export function labelWidthPx(text: string) {
  return text.length * charWidthPx
}

function labelFitsAlongArc(text: string, maxWidthPx: number) {
  return labelWidthPx(text) < maxWidthPx
}

// an empty label, or an arc too short to hang one off, draws nothing at all.
// One predicate, so `RulerLabel` and the room `labelGutterPx` reserves for it
// can't disagree about which labels exist
export function labelIsDrawn(text: string, maxWidthPx: number) {
  return !!text && maxWidthPx > 4
}

// the text a region labels itself with: its refName, or how many regions the
// elision swallowed. Taken off the region rather than the slice so the padding
// can reserve room for the labels before there is any geometry to build slices
// from — see `maxLabelGutterPx`
export function regionLabelText(region: SliceRegion) {
  return region.elided ? `[${toLocale(region.regions.length)}]` : region.refName
}

export function sliceLabelText(slice: Slice) {
  return regionLabelText(slice.region)
}

export function sliceArcWidthPx(slice: Slice, radiusPx: number) {
  return (slice.endRadians - slice.startRadians) * radiusPx
}

/**
 * Whether this figure's labels run along their arcs or radiate outward. One
 * answer for every label, so a circle never mixes the two: along the arcs only
 * when each drawn label fits its own.
 */
export function labelsRunAlongArcs({
  radiusPx,
  staticSlices,
}: {
  radiusPx: number
  staticSlices: Slice[]
}) {
  return staticSlices.every(slice => {
    const text = sliceLabelText(slice)
    const maxWidthPx = sliceArcWidthPx(slice, radiusPx)
    return (
      !labelIsDrawn(text, maxWidthPx) || labelFitsAlongArc(text, maxWidthPx)
    )
  })
}

/**
 * The most room this figure's labels could need outside the ruler arc, from the
 * label TEXT alone.
 *
 * An upper bound, and geometry-free on purpose: what a label really needs
 * depends on whether it fits along its own arc, which depends on the radius,
 * which depends on the padding this is used to decide. Breaking that cycle
 * costs a little slack on a figure whose labels all fit tangentially, and buys
 * an on-screen circle that cannot grow into its own labels — the centre sits at
 * `radiusPx + padding`, so a label reaching further than the padding is drawn
 * at a negative x and clipped by the box.
 */
export function maxLabelGutterPx(labels: string[]) {
  return labelOffsetPx + max(labels.map(labelWidthPx), 0)
}

/**
 * How far past the ruler arc this figure's labels actually reach: half a line
 * when they run along their arcs, the longest label when they radiate.
 *
 * The on-screen view reserves a fixed `paddingPx` for this and lives in a box
 * that clips anyway; an SVG export is a standalone artifact, so it sizes its
 * canvas to the labels it drew. The default 80px gutter is already too small
 * for 12-character RefSeq accessions, which came out cut off at the edge.
 */
export function labelGutterPx(model: {
  radiusPx: number
  staticSlices: Slice[]
}) {
  const { radiusPx, staticSlices } = model
  const alongArcs = labelsRunAlongArcs(model)
  return max(
    staticSlices.map(slice => {
      const text = sliceLabelText(slice)
      if (!labelIsDrawn(text, sliceArcWidthPx(slice, radiusPx))) {
        return 0
      }
      return (
        labelOffsetPx +
        // a tangential label is centered on the anchor, so it reaches outward
        // by half its height rather than by its length
        (alongArcs ? labelFontSizePx / 2 : labelWidthPx(text))
      )
    }),
    0,
  )
}

export const assemblyLabelFontSizePx = 15

// between the ruler labels and the assembly arc, and between that arc and the
// assembly's name
export const assemblyArcGapPx = 6

// what the assembly names add outside the ruler labels
export const assemblyBandPx = 2 * assemblyArcGapPx + assemblyLabelFontSizePx

export interface AssemblyArc {
  assemblyName: string
  startRadians: number
  endRadians: number
}

/**
 * One arc per run of consecutive slices from the same assembly, which is what
 * names the genomes on a circle holding more than one. None for a single
 * assembly, where the view's own title already says it.
 */
export function assemblyArcs(staticSlices: Slice[]) {
  const arcs: AssemblyArc[] = []
  for (const { region, startRadians, endRadians } of staticSlices) {
    const assemblyName = region.elided
      ? region.regions[0]?.assemblyName
      : region.assemblyName
    const last = arcs.at(-1)
    if (last?.assemblyName === assemblyName) {
      last.endRadians = endRadians
    } else if (assemblyName !== undefined) {
      arcs.push({ assemblyName, startRadians, endRadians })
    }
  }
  return new Set(arcs.map(a => a.assemblyName)).size > 1 ? arcs : []
}

/** The export's margin: the ruler labels, then the assembly names if any. */
export function figureGutterPx(model: {
  radiusPx: number
  staticSlices: Slice[]
}) {
  return (
    labelGutterPx(model) +
    (assemblyArcs(model.staticSlices).length > 0 ? assemblyBandPx : 0)
  )
}
