import { svgNodeId } from '@jbrowse/core/svg/svgId'
/* eslint-disable react-refresh/only-export-components */
import { SvgColorLegend } from '@jbrowse/core/ui'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { PaintLayer } from '@jbrowse/core/util/paintLayer'
import {
  SvgClipRect,
  renderDisplaySvg,
} from '@jbrowse/plugin-linear-genome-view'

import {
  LABEL_BASELINE_RATIO,
  LABEL_OVERLAY_BACKGROUND,
  MORE_ISOFORMS_FONT_SCALE,
  renderedTextWidth,
} from '../RenderFeatureDataRPC/constants.ts'
import { shouldRenderPeptideText } from '../RenderFeatureDataRPC/zoomThresholds.ts'
import {
  drawFeatureBlocks,
  drawHighlightBoxes,
} from './components/Canvas2DFeatureRenderer.ts'
import { highlightBoxColors } from './components/highlightUtils.ts'
import {
  LABEL_CULL_BUCKET_PX,
  forEachDisplayLabel,
  labelCullBand,
} from './components/labelPositioning.ts'
import { drawPeptidesForRegions } from './components/peptidePositioning.ts'

import type { FeatureDataResult } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { CanvasColorLegend } from './baseModel.ts'
import type { ResolvedLabel } from './components/labelPositioning.ts'
import type { SvgExportable } from '@jbrowse/core/svg/svgReady'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type {
  ExportSvgDisplayOptions,
  LgvSvgBodyProps,
} from '@jbrowse/plugin-linear-genome-view'

export interface RenderSvgModel extends SvgExportable {
  id: string
  height: number
  scrollTop: number
  regionTooLarge: boolean
  laidOutDataMap: ReadonlyMap<number, FeatureDataResult>
  highlightedFeatureIdSet: ReadonlySet<string>
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  // off only while a fit squeeze is scaling the rows these labels were reserved
  // in — see the model getter
  renderedShowSubfeatureLabels: boolean
  labelFontSize: number
  colorLegend: CanvasColorLegend | undefined
}

// Labels and amino-acid overlays are rendered as DOM/React overlays
// on-screen, so the on-screen renderer doesn't draw them. SVG export must
// bake them into the output, so they live here as a vector-only post-pass
// that runs after drawFeatureBlocks paints the geometry.
//
// Owns `ctx.font` rather than taking it set: the isoform badge draws smaller
// and italic (floatingLabelMore is the DOM half of the same choice), so the pass
// has two fonts in it and neither caller nor callee can hold just one. Free to
// reassign per label here — the export's ctx is an SvgCanvas, which stores the
// shorthand and parses it at serialize time.
function paintLabels(ctx: Ctx2D, labels: ResolvedLabel[], fontSize: number) {
  for (const resolved of labels) {
    const { label, labelX, labelY } = resolved
    if (resolved.kind === 'more') {
      // "+20 more" is a fact about the picture and belongs in it. Its expanded
      // form reads "show fewer", an instruction to a control the export does not
      // carry, over a gene the export has already drawn in full.
      if (resolved.label.expanded) {
        continue
      }
      ctx.font = `italic ${fontSize * MORE_ISOFORMS_FONT_SCALE}px sans-serif`
    } else {
      ctx.font = `${fontSize}px sans-serif`
      if (resolved.label.isOverlay) {
        ctx.fillStyle = LABEL_OVERLAY_BACKGROUND
        // The baked textWidth is measured at the base font size; scale it to
        // what this mode draws so the backing rect hugs the text like the
        // on-screen DOM version (a CSS background on the label div) does.
        ctx.fillRect(
          labelX - 1,
          labelY,
          renderedTextWidth(label.textWidth, fontSize) + 2,
          fontSize + 1,
        )
      }
    }
    ctx.fillStyle = label.color
    // labelY is the label's TOP (the DOM overlay positions the div by it), so
    // convert to the baseline fillText wants. Alphabetic baseline rather than
    // ctx.textBaseline = 'top': SvgCanvas maps that to dominant-baseline
    // "hanging", which downstream SVG consumers (Inkscape, librsvg) place
    // inconsistently, while an explicit y is portable everywhere. Rounded
    // because SvgCanvas interpolates coordinates raw — the unrounded product
    // serializes as y="21.240000000000002" for no visible gain.
    //
    // Off the shared line's size rather than each label's own, so the smaller
    // badge sits on the name's baseline instead of a lower one of its own.
    ctx.fillText(
      label.text,
      labelX,
      Math.round(labelY + fontSize * LABEL_BASELINE_RATIO),
    )
  }
}

export async function renderSvg(
  model: RenderSvgModel,
  opts?: ExportSvgDisplayOptions,
): Promise<React.ReactNode> {
  // renderDisplaySvg's awaitSvgReady waits for ALL visible regions, not just the
  // first to stream in, so whole-genome / multi-region exports aren't partially
  // drawn.
  return renderDisplaySvg(model, opts, CanvasFeaturesSvgBody)
}

function CanvasFeaturesSvgBody({
  model,
  view,
  height,
  canvasWidth,
  renderBlocks,
  opts,
}: LgvSvgBodyProps<RenderSvgModel>) {
  // The JBrowse palette, not Material UI's `useTheme`, for the same reason the
  // on-screen `overlayBoxStyles` reads it: `highlight` is a JBrowse entry a bare
  // Material theme doesn't have. `wrapSvgExport` mounts both providers from the
  // export theme, so this is still the theme the user picked in the dialog.
  const palette = usePalette()
  const visibleRegions = view.visibleRegions
  const renderPeptidesFlag = shouldRenderPeptideText(view.bpPerPx)

  // autoHeight defaults off, so a feature track is a fixed-height viewport with
  // vertical overflow the user scrolls. On-screen `renderState.scrollY` is
  // `self.scrollTop`; the export honors the same offset so a scrolled track
  // exports what's on screen (top viewport) rather than always the track top.
  const scrollY = model.scrollTop
  // Shared by the geometry pass and the highlight pass, so the boxes can't be
  // scissored against a different canvas than the glyphs they wrap.
  const renderState = { scrollY, canvasWidth, canvasHeight: height }
  const fontSize = model.labelFontSize
  const colorLegend = model.colorLegend
  // One label context for both consumers: the highlight boxes reserve exactly
  // the label width the label pass then paints.
  const labelContext = {
    showLabels: model.renderedShowLabels,
    showDescriptions: model.renderedShowDescriptions,
    showSubfeatureLabels: model.renderedShowSubfeatureLabels,
    fontSize,
  }
  // The export clips to the scrolled viewport (SvgClipRect below, `scrollY`
  // above), so a label whose feature sits outside it is written into the file
  // and then clipped away — on a fixed-height track scrolling over content many
  // times its height, that is most of them. Culled with the DOM overlay's own
  // band rather than a tighter export-only one: it is the band that ships on
  // screen, so the export emits exactly the labels the user is looking at.
  const cullBand = labelCullBand(
    Math.floor(scrollY / LABEL_CULL_BUCKET_PX),
    height,
  )

  return (
    <SvgClipRect
      id={`canvas-features-clip-${svgNodeId(model)}`}
      width={canvasWidth}
      height={height}
    >
      <PaintLayer
        width={canvasWidth}
        height={height}
        opts={opts}
        paint={ctx => {
          drawFeatureBlocks(
            ctx,
            model.laidOutDataMap,
            renderBlocks,
            renderState,
          )
        }}
      />
      {/* The three overlays the app canvas never paints — on-screen they are the
          highlight boxes (a DOM layer), the floating labels (another) and the
          peptide letters (their own canvas) — baked in here in the on-screen
          stacking order: boxes over the glyphs, labels over the boxes, peptides
          over both. One layer rather than three because the order within a
          layer already gives that, and because `opts` is deliberately withheld:
          all three stay vector even when `rasterizeLayers` is on, so exported
          text and box edges remain crisp. */}
      <PaintLayer
        width={canvasWidth}
        height={height}
        paint={ctx => {
          // Same highlight.main border/tint as the on-screen searchHighlightBox.
          drawHighlightBoxes(
            ctx,
            model.laidOutDataMap,
            renderBlocks,
            model.highlightedFeatureIdSet,
            renderState,
            highlightBoxColors(palette.highlight.main),
            labelContext,
          )
          // Labels/peptides are laid out in absolute track px (drawHighlightBoxes
          // above applies scrollY itself, as drawFeatureBlocks does); shift the
          // rest of the layer up by scrollY so text tracks the feature geometry
          // when scrolled.
          ctx.translate(0, -scrollY)
          forEachDisplayLabel(
            visibleRegions,
            model.laidOutDataMap,
            labelContext,
            (_, labels) => {
              paintLabels(ctx, labels, fontSize)
            },
            cullBand,
          )
          // Same peptide walk the app canvas runs (drawPeptidesForRegions), so
          // the export can't drift from on-screen. Peptides need no cross-region
          // dedup, unlike labels above: codons straddling a boundary overstrike
          // identically rather than doubling; labels differ only because
          // computeLabelPosition clamps X per region.
          if (renderPeptidesFlag) {
            drawPeptidesForRegions(ctx, model.laidOutDataMap, visibleRegions)
          }
        }}
      />
      {/* The same color key the display shows on screen (the `colorLegend` hook —
          variants' consequence-impact / SV-type presets; absent for a plain
          feature track). Without it an exported figure has colored glyphs and
          nothing saying what the colors mean. Vector, via the shared
          SvgColorLegend the multi-row painting export already uses; no
          `onDismiss`, since an exported legend can't be clicked. Skipped when
          the user has put the key away on screen, so the export matches what
          they were looking at. */}
      {colorLegend && !colorLegend.dismissed ? (
        <SvgColorLegend
          canvasWidth={canvasWidth}
          maxHeight={height}
          testid="canvas-color-legend"
          entries={colorLegend.items.map(item => ({
            key: item.label,
            label: item.label,
            color: item.color,
          }))}
        />
      ) : null}
    </SvgClipRect>
  )
}
