import { max, radToDeg, toLocale } from '@jbrowse/core/util'

import type { Slice, SliceRegion } from './slices.ts'

// The label geometry `Ruler.tsx` draws with, kept here rather than there so the
// SVG export can measure a figure without importing a component module (which
// react-refresh requires stay component-only).
export const labelFontSizePx = 13

// the ideogram is a band this far outside the circle's radius, where the
// ribbons and the outermost ring stop, and this thick
export const ideogramGapPx = 2
export const ideogramThicknessPx = 8

// base-pair ticks stand on the ideogram's outer edge, a major tick's label
// just past its tip
export const tickMajorPx = 5
export const tickMinorPx = 3
export const tickLabelGapPx = 2
export const tickFontSizePx = 10

// how far outside the circle's radius the base-pair ticks and their labels
// reach
export const tickReachPx =
  ideogramGapPx +
  ideogramThicknessPx +
  tickMajorPx +
  tickLabelGapPx +
  tickFontSizePx

// how far outside the circle's radius a label is anchored: past the ticks
export const labelOffsetPx = tickReachPx + 5

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

/**
 * The contig a circle of one names in its middle, beside its length, the way
 * a plasmid map titles itself. Its arc then carries no label.
 */
export function middleTitle(staticSlices: readonly Slice[]) {
  const [only, ...rest] = staticSlices
  return only && rest.length === 0 && !only.region.elided
    ? only.region
    : undefined
}

/** The text on a slice's arc: its region's, unless the middle names it. */
export function sliceLabelText(slice: Slice, staticSlices: readonly Slice[]) {
  return middleTitle(staticSlices) ? '' : regionLabelText(slice.region)
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
    const text = sliceLabelText(slice, staticSlices)
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
  return labels.length
    ? labelOffsetPx + max(labels.map(labelWidthPx), 0)
    : tickReachPx
}

/**
 * How far past the ruler arc this figure's labels actually reach: the ticks,
 * then half a line when the labels run along their arcs, the longest label
 * when they radiate.
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
      const text = sliceLabelText(slice, staticSlices)
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
    tickReachPx,
  )
}

export const assemblyLabelFontSizePx = 15

// between the ruler labels and the assembly arc, and between that arc and the
// assembly's name
export const assemblyArcGapPx = 10

// what the assembly names add outside the ruler labels
export const assemblyBandPx = 2 * assemblyArcGapPx + assemblyLabelFontSizePx

export interface AssemblyArc {
  assemblyName: string
  startRadians: number
  endRadians: number
}

/**
 * One arc per run of consecutive slices from the same assembly, labelling the
 * genomes on a circle holding more than one. None for a single
 * assembly, where the view's own title already says it.
 */
export function assemblyArcs(staticSlices: Slice[]) {
  const arcs: AssemblyArc[] = []
  for (const { region, startRadians, endRadians } of staticSlices) {
    const assemblyName = region.elided
      ? region.regions[0]?.assemblyName
      : region.assemblyName
    const last = arcs.at(-1)
    if (last !== undefined && last.assemblyName === assemblyName) {
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

// The view rotates the whole figure by offsetRadians, so which half of the
// screen a label lands on - and therefore which way it has to be flipped to
// read right-side-up - depends on that rotation too. cos/sin of the on-screen
// angle answer that without normalizing offsetRadians, which grows without
// bound as the user rotates.
//
// Along the arc: centered, flipped end-for-end on the bottom half. Radial:
// radiating outward from the arc, flipped on the left half. Both flips keep the
// anchored text outside the arc.
export function labelPlacement(
  radians: number,
  offsetRadians: number,
  alongArc: boolean,
) {
  const deg = radToDeg(radians)
  const rightHalf = Math.cos(radians + offsetRadians) > 0
  const bottomHalf = onBottomHalf(radians, offsetRadians)
  return alongArc
    ? { textAnchor: 'middle' as const, rotation: deg + (bottomHalf ? -90 : 90) }
    : rightHalf
      ? { textAnchor: 'start' as const, rotation: deg }
      : { textAnchor: 'end' as const, rotation: deg + 180 }
}

/** Whether a turn of the rotated figure lands on the screen's lower half. */
export function onBottomHalf(radians: number, offsetRadians: number) {
  return Math.sin(radians + offsetRadians) > 0
}
