import { SvgClipRect } from '@jbrowse/core/svg/SvgExport'
import { useExportFontFamily } from '@jbrowse/core/svg/constants'
import { svgNodeId } from '@jbrowse/core/svg/svgId'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { stripAlpha } from '@jbrowse/core/util'

import {
  REF_NAME_LABEL_FONT_SIZE,
  TICK_LABEL_FONT_SIZE,
  getScalebarRefNameLabels,
  labelFitsInBlock,
  refNameLabelFitsInView,
  refNameLabelWidth,
  tickLabelWidth,
} from '../util.ts'
import SVGRegionSeparators from './SVGRegionSeparators.tsx'
import {
  RULER_MAJOR_TICK,
  RULER_MINOR_TICK,
  getRulerLayout,
  gridlineTickXs,
  refNameLabelBaselineY,
  vlinePath,
} from './util.ts'

import type { ScalebarRefNameLabel } from '../util.ts'
import type { LgvSvgChromeView } from './util.ts'

// Tick marks and their coordinate labels, read from the same model getters the
// on-screen Gridlines/ScalebarCoordinateLabels use (gridlineTicks /
// scalebarLabels), so tick pitch, label text and label placement can't drift
// from the screen. Both are computed in the staticBlocks frame, which overhangs
// the viewport, so shift by the view's `staticBlocksTranslateX` and let the
// caller's clip trim the overhang.
function Ruler({
  model,
  tickTopY,
  numbersBaselineY,
}: {
  model: LgvSvgChromeView
  // Top y of the tick marks; they hang downward toward the tracks.
  tickTopY: number
  // Baseline y for the tick-number text, positioned above the tick marks.
  numbersBaselineY: number
}) {
  const palette = usePalette()
  const fontFamily = useExportFontFamily()
  const color = stripAlpha(palette.text.secondary)
  const { scalebarLabels, width } = model
  const { dx, major, minor } = gridlineTickXs(model)
  // major and minor marks share a stroke and differ only in length, so both
  // collapse into a single path
  const ticks =
    vlinePath(major, tickTopY, tickTopY + RULER_MAJOR_TICK) +
    vlinePath(minor, tickTopY, tickTopY + RULER_MINOR_TICK)
  return (
    <>
      <path d={ticks} strokeWidth={1} stroke={color} fill="none" />
      {/* Centered on the tick (textAnchor middle), matching the on-screen
      scalebar's zero-width flex tick. scalebarLabels only drops labels that
      overrun their *region*, so one at the view's edge survives it and would
      export half-cut by the clip below — on screen that reads as a label
      scrolled partly out of frame, but a static image has no frame to scroll,
      so drop it instead, measured in the export's font. */}
      {scalebarLabels
        .filter(({ x, label }) => {
          const w = tickLabelWidth(label, fontFamily)
          return labelFitsInBlock(dx + x - w / 2, w, width)
        })
        .map(({ x, label, key }) => (
          <text
            key={key}
            x={dx + x}
            y={numbersBaselineY}
            textAnchor="middle"
            fontSize={TICK_LABEL_FONT_SIZE}
            fill={color}
          >
            {label}
          </text>
        ))}
    </>
  )
}

/**
 * The label as the export can draw it whole in `fontFamily`: its own text, else
 * the bare refName where that text carried a reversed marker, else none.
 * `getScalebarRefNameLabels` fitted it in the app's font, against its run of
 * regions only, and the run routinely continues past the view's right edge.
 */
function exportedRefNameLabel(
  label: ScalebarRefNameLabel,
  viewWidth: number,
  fontFamily?: string,
) {
  return [label.text, label.refName]
    .map(text => ({ ...label, text }))
    .find(
      fitted =>
        fitted.paddingLeft + refNameLabelWidth(fitted.text, fontFamily) <=
          fitted.maxWidth &&
        refNameLabelFitsInView(fitted, viewWidth, fontFamily),
    )
}

// Chromosome/refName labels along the ruler. Reuses the on-screen scalebar's
// sticky-label logic (getScalebarRefNameLabels) so the exported name stays
// pinned to the viewport's left edge when a region has scrolled off — otherwise
// the name renders off-canvas whenever you export a view zoomed into a
// chromosome interior. No assembly-name prefix here (unlike the on-screen
// scalebar): the SVG export already draws the assembly name above the ruler.
//
// `orientation` is not redundant, and this is the surface that needed it most.
// A stacked export gives each row SVGRowHeader — assembly name, ruler, refName
// labels — and no locstring, so a flipped row used to leave the numbers
// counting down as the only evidence it was flipped. On screen the search box
// says so; a figure has no search box.
//
// A name is drawn whole or not at all, as the tick numbers are: clipped
// mid-glyph, "chr16" reads as "chr1".
function SVGRefNameLabels({ model }: { model: LgvSvgChromeView }) {
  const palette = usePalette()
  const fontFamily = useExportFontFamily()
  const fill = stripAlpha(palette.text.primary)
  const { labels, caption } = getScalebarRefNameLabels({
    blocks: model.staticBlocks.blocks,
    offsetPx: model.offsetPx,
    prefix: undefined,
    orientation: model.displayedRegionsOrientation,
  })
  return (
    <>
      {/* With no prefix asked for, the caption is here only to say the row is
      flipped — and it is the whole reason orientation reaches this component.
      The labels are already inset clear of it. */}
      {caption === undefined ? null : (
        <text
          x={0}
          y={refNameLabelBaselineY}
          fontSize={REF_NAME_LABEL_FONT_SIZE}
          fontWeight="bold"
          fill={fill}
        >
          {caption}
        </text>
      )}
      {labels
        .map(label => exportedRefNameLabel(label, model.width, fontFamily))
        .filter(label => label !== undefined)
        .map(label => (
          <text
            key={label.key}
            x={label.transform + label.paddingLeft}
            y={refNameLabelBaselineY}
            fontSize={REF_NAME_LABEL_FONT_SIZE}
            fontWeight="bold"
            fill={fill}
          >
            {label.text}
          </text>
        ))}
    </>
  )
}

export default function SVGRuler({
  model,
  rulerHeight,
}: {
  model: LgvSvgChromeView
  // Total vertical budget for this ruler (refName label + tick numbers + tick
  // marks), matching the caller's own row-height math. The tick marks are
  // anchored to the bottom of this budget (minus a small margin) so they can
  // never spill into the content that starts right below; the tick numbers sit
  // just above the marks.
  rulerHeight: number
}) {
  const { tickTopY, numbersBaselineY } = getRulerLayout(rulerHeight)
  return (
    // the tick and block frames overhang the viewport on both sides; clip so
    // ticks, tick numbers, refName labels and the region-separator bar at the
    // last region's right edge can't bleed into the export margin (on screen
    // the scalebar's overflow:hidden does this)
    <SvgClipRect
      id={`ruler-clip-${svgNodeId(model)}`}
      width={model.width}
      height={rulerHeight}
    >
      <SVGRegionSeparators model={model} height={rulerHeight} />
      <Ruler
        model={model}
        tickTopY={tickTopY}
        numbersBaselineY={numbersBaselineY}
      />
      <SVGRefNameLabels model={model} />
    </SvgClipRect>
  )
}
