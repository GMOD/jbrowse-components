import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { alpha } from '@jbrowse/core/ui/palette'
import { pluralize } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import {
  LABEL_BASELINE_RATIO,
  MORE_ISOFORMS_FONT_SCALE,
} from '../../RenderFeatureDataRPC/constants.ts'
import PeptideCanvas from './PeptideCanvas.tsx'
import {
  computeOverlayRect,
  highlightBoxColors,
  overlayItemRect,
} from './highlightUtils.ts'
import { HIT_PAD_PX } from './hitTesting.ts'
import { htmlToPlainText } from './hoverReadout.ts'
import {
  computeLabelExtraWidth,
  forEachDisplayLabel,
  labelCullBand,
} from './labelPositioning.ts'
import { LABEL_OVERLAY_BACKGROUND } from './sharedRendererConstants.ts'

import type {
  FeatureDataResult,
  FlatbushItem,
  MoreIsoformsLabel,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { LinearCanvasBaseDisplayModel } from '../baseModel.ts'
import type { FeatureContextMenuInfo } from '../featureContextMenu.ts'
import type { FeatureItemEntry, VisibleRegion } from './hitTesting.ts'
import type {
  MoreResolvedLabel,
  PlainResolvedLabel,
} from './labelPositioning.ts'
import type { JBrowsePalette } from '@jbrowse/core/ui/palette'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'
import type { CSSProperties } from 'react'

type LGV = LinearGenomeViewModel

// The two layers take narrow structural slices of the display rather than the
// whole `LinearCanvasBaseDisplayModel`, so each can be rendered in a unit test
// against a plain object (see overlayElements.test.tsx). The guards below prove
// at compile time that the real model still satisfies both, so a renamed model
// field is an error here instead of a silent undefined at runtime — the same
// AssignableTo idiom baseModel.ts uses for the persisted highlight model.
type AssignableTo<A extends B, B> = A

interface FloatingLabelsModel {
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  // off only while a fit squeeze is scaling the rows these labels were reserved
  // in — see the model getter
  renderedShowSubfeatureLabels: boolean
  // the canvas' CSS width, off the model rather than a second
  // `view.trackWidthPx` read — see `MultiRegionDisplayMixin.canvasWidthPx`
  canvasWidthPx: number
  labelFontSize: number
  // viewport height + quantized scroll bucket drive the label vertical cull
  // (labelCullBand). The bucket, not raw scrollTop, keeps a scroll tick within
  // one bucket from rebuilding the label DOM.
  height: number
  // virtual-scroll content height, sizing the peptide canvas
  contentHeight: number
  labelScrollBucket: number
  featureItemMap: Map<string, FeatureItemEntry>
  renderDataMap: ReadonlyMap<number, FeatureDataResult>
  openContextMenu: (info: FeatureContextMenuInfo) => void
  selectFeatureById: (
    featureId: string,
    subfeatureInfo: SubfeatureInfo | undefined,
    displayedRegionIndex: number,
  ) => void
  toggleSoloFeature: (featureId: string) => void
  // opens/re-collapses one gene's isoforms, from the badge on its label
  toggleExpandedGene: (featureId: string) => void
}

interface HighlightBoxesModel {
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  // as on FloatingLabelsModel above
  canvasWidthPx: number
  // resolved label size for the display mode; the boxes reserve label width, and
  // baked widths are measured at the base size (see renderedTextWidth)
  labelFontSize: number
  selectedFeatureId: string | undefined
  hoveredFeature: FlatbushItem | null
  hoveredSubfeature: SubfeatureInfo | null
  featureItemMap: Map<string, FeatureItemEntry>
  // Y a feature's glyph is currently drawn off its laid-out row by, mid Y-morph.
  // featureItemMap holds the destination rows (hit targets), so every box adds
  // this to keep framing the glyph while it eases; 0 whenever nothing is easing.
  morphOffsetFor: (featureId: string) => number
  // render-item ids resolved from a declarative search highlight; addFeatureBox
  // no-ops any id not currently laid out (same as soloFeatureIdSet)
  highlightedFeatureIdSet: ReadonlySet<string>
  // the "show only these features" collection and whether it's isolating yet.
  // While collecting (not applied) each member is boxed so ctrl+click has
  // visual feedback; once applied the view already shows only these, so the
  // boxes would be redundant noise.
  soloFeatureIdSet: ReadonlySet<string>
  soloApplied: boolean
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ModelSatisfiesFloatingLabels = AssignableTo<
  LinearCanvasBaseDisplayModel,
  FloatingLabelsModel
>
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ModelSatisfiesHighlightBoxes = AssignableTo<
  LinearCanvasBaseDisplayModel,
  HighlightBoxesModel
>

// The badge draws smaller than the name it sits beside, and both divs are
// positioned by their TOP with `line-height: 1` — so aligning their tops floats
// the badge's baseline ~1.4px above the name's and it reads as a superscript
// rather than as part of the line. Push it down by the difference the two font
// sizes make to where a baseline falls inside its own box.
//
// `labelY` therefore stays the shared line's top, which is what the SVG export
// wants: `paintLabels` converts to a baseline with the NAME's size for every
// label, arriving at the same place from the other side.
function moreBadgeTop(labelY: number, fontSize: number) {
  return (
    labelY + fontSize * (1 - MORE_ISOFORMS_FONT_SCALE) * LABEL_BASELINE_RATIO
  )
}

// The badge has one short row to live in, so its text is terse ("+3 more") and
// this spells it out — a title rather than the model hover the rest of the layer
// sets, since that one describes the FEATURE and this is the layer's one control.
function moreIsoformsTitle({ hidden, expanded }: MoreIsoformsLabel) {
  const isoforms = `${hidden} ${pluralize(hidden, 'isoform')}`
  return expanded
    ? `Collapse this gene, hiding ${isoforms} again`
    : `${isoforms} not shown — click to expand this gene`
}

type LabelClasses = Record<
  'clickable' | 'static',
  Record<'overlay' | 'plain', string>
>

// The isoform badge, and the only label here that is a control. It carries the
// `more` marker the layer's delegated handlers route on, and stays clickable
// whether or not its gene resolves to an openable feature — expanding reads the
// id straight off the attribute. Its baked width is measured at the scale it
// draws at, so the room the packer reserved is the room it takes.
//
// It carries the region index like a name does, because the layer's other two
// pointer paths still treat it as its gene's: right-clicking it opens the gene's
// context menu, and half those rows need a region to resolve against.
function MoreIsoformsBadge({
  resolved,
  featureId,
  displayedRegionIndex,
  labelFontSize,
  className,
}: {
  resolved: MoreResolvedLabel
  featureId: string
  displayedRegionIndex: number
  labelFontSize: number
  className: string
}) {
  const { label, labelX, labelY } = resolved
  return (
    <div
      title={moreIsoformsTitle(label)}
      data-testid={`feature-more-isoforms-${featureId}`}
      data-feature-id={featureId}
      data-more-isoforms=""
      data-region-index={displayedRegionIndex}
      className={className}
      style={{
        color: label.color,
        fontSize: labelFontSize * MORE_ISOFORMS_FONT_SCALE,
        transform: `translate(${labelX}px, ${moreBadgeTop(labelY, labelFontSize)}px)`,
      }}
    >
      {label.text}
    </div>
  )
}

// A gene's name, its description, or a subfeature's name. Carries its ids as
// data attributes for the layer's delegated handlers, so rebuilding every label
// each frame allocates no per-label closure.
function FloatingLabel({
  resolved,
  featureId,
  displayedRegionIndex,
  labelFontSize,
  clickable,
  labelClasses,
}: {
  resolved: PlainResolvedLabel
  featureId: string
  displayedRegionIndex: number
  labelFontSize: number
  clickable: boolean
  labelClasses: LabelClasses
}) {
  const { label, labelX, labelY, kind } = resolved
  return (
    <div
      data-testid={clickable ? `feature-${kind}-${label.text}` : undefined}
      data-feature-id={clickable ? featureId : undefined}
      data-region-index={clickable ? displayedRegionIndex : undefined}
      className={
        labelClasses[clickable ? 'clickable' : 'static'][
          label.isOverlay ? 'overlay' : 'plain'
        ]
      }
      style={{
        color: label.color,
        fontSize: labelFontSize,
        transform: `translate(${labelX}px, ${labelY}px)`,
      }}
    >
      {label.text}
    </div>
  )
}

// Whether two regions are the same reference sequence — assembly AND refName.
// The pair, not refName alone, is what names a sequence here: it is the key the
// layout groups rows by (`regionKey` in baseModel) and the one AGENTS.md
// requires layouts to stay independent across. The overlay resolves region
// identity the same way rather than by a looser rule of its own.
//
// This is only observable in a view whose displayedRegions span assemblies,
// which is not something JBrowse does in practice. It keeps the overlay's notion
// of "same sequence" from being the odd one out; it is not fixing a symptom you
// can reach today.
function sameRefSeq(
  a: { assemblyName: string; refName: string },
  b: { assemblyName: string; refName: string },
) {
  return a.assemblyName === b.assemblyName && a.refName === b.refName
}

// Shared gate for both layers: nothing to position until the view is sized and
// at least one region is on screen.
function overlaysReady(
  viewInitialized: boolean,
  width: number | undefined,
  bpPerPx: number,
  visibleRegions: VisibleRegion[],
) {
  return viewInitialized && !!width && !!bpPerPx && visibleRegions.length > 0
}

// Geometry only. The colors live in `overlayBoxStyles` below, applied inline,
// because they come from JBrowse's palette rather than a Material UI theme:
// `highlight`, `featureHover` and `featureSelected` are JBrowse's own entries,
// which a bare Material UI theme does not have. Keeping them out of here is
// what lets this display render in a host that mounts a `PaletteProvider` and
// no `ThemeProvider` at all.
/**
 * The palette-dependent half of the overlay boxes, as inline styles. Pure, so
 * SVG export and tests can build the same boxes without mounting anything.
 */
function overlayBoxStyles(palette: JBrowsePalette) {
  const highlightBox = highlightBoxColors(palette.highlight.main)
  return {
    hover: { backgroundColor: palette.featureHover },
    solo: {
      border: `2px dashed ${palette.primary.main}`,
      borderRadius: 3,
      backgroundColor: alpha(palette.primary.main, 0.15),
    },
    searchHighlight: {
      border: `1px solid ${highlightBox.border}`,
      borderRadius: 3,
      backgroundColor: highlightBox.fill,
    },
    selected: {
      border: `2px solid ${palette.featureSelected}`,
      borderRadius: 3,
    },
  }
}

const useStyles = makeStyles()(() => {
  return {
    // Absolute layer holding the highlight boxes. Owned here rather than by the
    // canvas body, so the layer and the boxes it wraps can't disagree about
    // whether there is anything to wrap.
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    },
    // Absolute layer holding every floating label. It owns ONE delegated
    // click/contextmenu/mousemove handler (see the layer component below) rather than a
    // per-label closure, so repositioning during zoom/pan — which rebuilds all
    // labels each frame — allocates no per-feature handlers. pointerEvents:none
    // lets mouse events fall through to the canvas everywhere except over a
    // clickable label (which re-enables them and bubbles up to this layer's
    // delegated handler).
    labelLayer: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    },
    // Color is applied inline per-label from the worker-baked label.color (the
    // single source of truth the SVG export also consumes), so the DOM overlay
    // and the export can't drift. It's safe to read here rather than re-deriving
    // from the live theme because the active theme is an RPC cache key
    // (rpcProps.theme): switching themes clears and refetches, so a shown label's
    // baked color always matches the current theme. fontSize is likewise inline
    // from the model's resolved label size (it shrinks in compact display modes).
    floatingLabel: {
      position: 'absolute',
      lineHeight: 1,
      whiteSpace: 'nowrap',
    },
    floatingLabelClickable: {
      pointerEvents: 'auto',
      cursor: 'pointer',
    },
    floatingLabelStatic: {
      pointerEvents: 'none',
    },
    // The isoform badge ("+3 more"): an aside on the gene's name, not a second
    // label, so it is italic and — via the worker-baked label.color, like every
    // other label here — a translucent grey, at MORE_ISOFORMS_FONT_SCALE of the
    // name's size. What keeps it from receding out of existence is the
    // underline and the pointer: it is the affordance, not a readout.
    floatingLabelMore: {
      pointerEvents: 'auto',
      cursor: 'pointer',
      fontStyle: 'italic',
      textDecoration: 'underline',
    },
    // Light backing rect for overlay labels; the text color still comes from the
    // baked label.color (worker sets it to a dark tone that reads on this rect).
    floatingLabelOverlay: {
      background: LABEL_OVERLAY_BACKGROUND,
    },
    // Overlay boxes: only left/top/width/height vary per-feature (inline); the
    // appearance below is all static theme derivation. Weight ranks the states:
    // selection (2px solid) is the strongest, the search highlight is deliberately
    // lighter (1px, translucent border + faint tint) so it reads as transient.
    overlayBase: {
      position: 'absolute',
      pointerEvents: 'none',
    },
  }
})

// Floating labels + the peptide canvas. Both derive purely from the laid-out
// rows and view geometry — never from the cursor or hover state — so this is its
// own observer: a mouse move (which only mutates the hover observables
// HighlightLayer reads) never re-runs the per-feature label build.
//
// Labels follow the animated rows (`renderDataMap`) so they move with the glyphs
// during a layout transition, while the canvas body hit-tests the destination
// layout (`laidOutDataMap`) so hover targets the final positions.
export const FloatingLabelsLayer = observer(function FloatingLabelsLayer({
  model,
  view,
  onLabelMouseOver,
  onLabelMouseLeave,
}: {
  model: FloatingLabelsModel
  view: LGV
  // Just the item: the label's own hover sets the model's hover, and the
  // tooltip's POSITION comes from the chrome's pointer tracker rather than from
  // this event. It used to carry the region index and the event so the caller
  // could stash `clientX`/`clientY` in React state.
  onLabelMouseOver?: (item: FlatbushItem) => void
  onLabelMouseLeave?: () => void
}) {
  const { classes, cx } = useStyles()
  const {
    renderedShowLabels,
    renderedShowDescriptions,
    labelFontSize,
    height,
    labelScrollBucket,
    featureItemMap,
    renderDataMap,
    openContextMenu,
    selectFeatureById,
    toggleSoloFeature,
    toggleExpandedGene,
  } = model
  const viewInitialized = view.initialized
  const width = viewInitialized ? model.canvasWidthPx : undefined
  const bpPerPx = view.bpPerPx
  const visibleRegions = view.visibleRegions as VisibleRegion[]

  const peptides = (
    <PeptideCanvas
      renderDataMap={renderDataMap}
      visibleRegions={visibleRegions}
      viewInitialized={viewInitialized}
      width={width}
      height={model.contentHeight}
      bpPerPx={bpPerPx}
    />
  )

  if (!overlaysReady(viewInitialized, width, bpPerPx, visibleRegions)) {
    return peptides
  }

  const elements: React.ReactElement[] = []
  const context = {
    showLabels: renderedShowLabels,
    showDescriptions: renderedShowDescriptions,
    showSubfeatureLabels: model.renderedShowSubfeatureLabels,
    fontSize: labelFontSize,
  }
  const cullBand = labelCullBand(labelScrollBucket, height)

  // cx() is emotion's merge(): for emotion-registered classes it re-serializes
  // and re-hashes the combined style on every call. Only these four
  // combinations exist, so resolve them once per render rather than once per
  // label on a path that rebuilds every label each frame during zoom/pan.
  const labelClass = (clickable: boolean, isOverlay: boolean) =>
    cx(
      classes.floatingLabel,
      clickable ? classes.floatingLabelClickable : classes.floatingLabelStatic,
      isOverlay ? classes.floatingLabelOverlay : undefined,
    )
  const labelClasses = {
    clickable: {
      overlay: labelClass(true, true),
      plain: labelClass(true, false),
    },
    static: {
      overlay: labelClass(false, true),
      plain: labelClass(false, false),
    },
  }
  // same reason, and it was the one combination left in the loop
  const moreBadgeClass = cx(classes.floatingLabel, classes.floatingLabelMore)

  forEachDisplayLabel(
    visibleRegions,
    renderDataMap,
    context,
    (featureId, labels, vr) => {
      const displayedRegionIndex = vr.displayedRegionIndex
      // A label is clickable iff it resolves to a top-level feature we can
      // open. Description labels are included: for variants with no ID the
      // description ("C -> T") is the only visible label, and a user clicking
      // it expects the feature details. The label carries its ids as data
      // attributes; the layer's delegated handler (below) resolves them at
      // event time, so rebuilding a label allocates no handler.
      const clickable = featureItemMap.get(featureId)?.kind === 'feature'
      for (const resolved of labels) {
        const key = `${displayedRegionIndex}-${featureId}-${resolved.kind}`
        elements.push(
          resolved.kind === 'more' ? (
            <MoreIsoformsBadge
              key={key}
              resolved={resolved}
              featureId={featureId}
              displayedRegionIndex={displayedRegionIndex}
              labelFontSize={labelFontSize}
              className={moreBadgeClass}
            />
          ) : (
            <FloatingLabel
              key={key}
              resolved={resolved}
              featureId={featureId}
              displayedRegionIndex={displayedRegionIndex}
              labelFontSize={labelFontSize}
              clickable={clickable}
              labelClasses={labelClasses}
            />
          ),
        )
      }
    },
    cullBand,
  )

  if (elements.length === 0) {
    return peptides
  }

  // One delegated handler set for the whole layer, resolving the label under
  // the cursor via its data-feature-id (see the label divs above). Feature
  // lookup happens at event time (rare) against the current featureItemMap, so
  // no per-label closure is created on the per-frame rebuild path.
  const labelElementAt = (e: React.MouseEvent) =>
    e.target instanceof HTMLElement
      ? e.target.closest<HTMLElement>('[data-feature-id]')
      : null

  // The gene id when the event landed on an isoform badge, else undefined.
  // Answered off the badge's own marker rather than off `featureItemMap`,
  // because expanding needs nothing but the id — and a badge whose gene has
  // scrolled out of the laid-out map is not a badge the user can be pointing at.
  const resolveMoreIsoforms = (e: React.MouseEvent) => {
    const el = labelElementAt(e)
    return el?.dataset.moreIsoforms === undefined
      ? undefined
      : el.dataset.featureId
  }

  const resolveTarget = (e: React.MouseEvent) => {
    const el = labelElementAt(e)
    const featureId = el?.dataset.featureId
    const entry = featureId ? featureItemMap.get(featureId) : undefined
    return el && entry?.kind === 'feature'
      ? {
          item: entry.item,
          displayedRegionIndex: Number(el.dataset.regionIndex),
        }
      : undefined
  }
  return (
    <div
      className={classes.labelLayer}
      onClick={e => {
        // Checked ahead of the feature paths: the badge sits inside the label
        // layer and carries a feature id of its own, so without this a click on
        // it would open the gene's details instead of opening the gene.
        const geneId = resolveMoreIsoforms(e)
        if (geneId !== undefined) {
          toggleExpandedGene(geneId)
          return
        }
        const t = resolveTarget(e)
        if (t) {
          // Same two gestures the canvas offers (see FeatureComponent's
          // handleClick): ctrl/cmd+click collects into the show-only list,
          // plain click opens the details. A label sits ON its feature, so a
          // ctrl+click that landed on the name rather than the glyph has to
          // mean the same thing — otherwise collecting a run of features
          // silently opened a widget whenever the cursor caught a label.
          if (e.ctrlKey || e.metaKey) {
            toggleSoloFeature(t.item.featureId)
          } else {
            selectFeatureById(
              t.item.featureId,
              undefined,
              t.displayedRegionIndex,
            )
          }
        }
      }}
      onContextMenu={e => {
        const t = resolveTarget(e)
        if (t) {
          e.preventDefault()
          // No base and no hit to read a transcript off — this is a click on
          // a name — so no HGVS position. The tooltip text is the feature's
          // own, which is exactly what hovering this label shows, stripped to
          // plain text the same way the canvas path does it.
          openContextMenu({
            item: t.item,
            displayedRegionIndex: t.displayedRegionIndex,
            clientX: e.clientX,
            clientY: e.clientY,
            tooltipText: htmlToPlainText(t.item.tooltip),
          })
        }
      }}
      onMouseMove={e => {
        // Checked ahead of the feature path for the same reason the click is:
        // the badge carries a feature id, so it would otherwise raise the
        // GENE's tooltip on top of its own `title` — two tooltips on one 40px
        // control, saying different things. Clearing rather than returning,
        // because the cursor reached the badge across the name it sits after,
        // and that pass already set the hover.
        if (resolveMoreIsoforms(e) !== undefined) {
          onLabelMouseLeave?.()
          return
        }
        const t = resolveTarget(e)
        if (t && onLabelMouseOver) {
          onLabelMouseOver(t.item)
        }
      }}
      // A clickable label is stacked above the canvas, so entering one fires the
      // canvas's mouseleave (which clears the hover) and the mousemove above
      // re-sets it from the label. Leaving the label back onto the canvas is
      // covered by the canvas's own mousemove, but leaving it to anywhere else —
      // off the track edge, onto an adjacent track, out of the window — hits no
      // canvas handler at all, so without this the label's hover shading and
      // tooltip stay stuck. React dispatches leave to this layer when the cursor
      // exits a label (labels are its descendants) even though the layer itself
      // is pointerEvents:none.
      onMouseLeave={() => {
        onLabelMouseLeave?.()
      }}
    >
      {elements}
      {peptides}
    </div>
  )
})

// Hover / selection / solo / search highlight boxes. Split from the labels
// because this reads hoveredFeature/hoveredSubfeature, which change on every
// mouse move — its own observer means a hover tick re-renders just these few
// boxes, not the whole floating-label build.
export const HighlightLayer = observer(function HighlightLayer({
  model,
  view,
}: {
  model: HighlightBoxesModel
  view: LGV
}) {
  const {
    hoveredFeature,
    hoveredSubfeature,
    selectedFeatureId,
    highlightedFeatureIdSet,
    soloFeatureIdSet,
    soloApplied,
    renderedShowLabels,
    renderedShowDescriptions,
    labelFontSize,
    featureItemMap,
    morphOffsetFor,
  } = model
  const { classes, cx } = useStyles()
  const boxStyles = overlayBoxStyles(usePalette())
  const viewInitialized = view.initialized
  const width = viewInitialized ? model.canvasWidthPx : undefined
  const bpPerPx = view.bpPerPx
  const visibleRegions = view.visibleRegions as VisibleRegion[]

  if (!overlaysReady(viewInitialized, width, bpPerPx, visibleRegions)) {
    return null
  }

  const overlays: React.ReactElement[] = []

  const addOverlay = ({
    item,
    source,
    className,
    key,
    extraWidth = 0,
    xPadding = 0,
    yPadding = 0,
    yOffset = 0,
    testId,
    boxStyle,
  }: {
    item: { startBp: number; endBp: number; topPx: number; bottomPx: number }
    // the region the item was laid out in; a feature spanning a displayed-region
    // boundary is boxed piecewise across every region on that same reference
    // sequence, so this identifies the sequence, not the one region
    source: { assemblyName: string; refName: string }
    className?: string
    key: string
    extraWidth?: number
    xPadding?: number
    yPadding?: number
    // px the glyph is currently displaced from `item`'s row by an in-flight
    // Y-morph, applied to the box's top so it travels with what it frames
    yOffset?: number
    testId?: string
    boxStyle?: CSSProperties
  }) => {
    for (const vr of visibleRegions) {
      if (!sameRefSeq(vr, source)) {
        continue
      }
      const rect = overlayItemRect(item, vr)
      if (rect) {
        overlays.push(
          <div
            key={`${key}-${vr.displayedRegionIndex}`}
            data-testid={testId}
            className={cx(classes.overlayBase, className)}
            style={{
              ...computeOverlayRect(
                yOffset === 0 ? rect : { ...rect, topPx: rect.topPx + yOffset },
                extraWidth,
                xPadding,
                yPadding,
              ),
              ...boxStyle,
            }}
          />,
        )
      }
    }
  }

  const computeExtraWidth = (entry: FeatureItemEntry) => {
    if (entry.kind !== 'feature') {
      return 0
    }
    const labelData = entry.data.floatingLabelsData[entry.item.featureId]
    if (!labelData) {
      return 0
    }
    const featureWidthPx = (entry.item.endBp - entry.item.startBp) / bpPerPx
    return computeLabelExtraWidth(
      labelData,
      featureWidthPx,
      renderedShowLabels,
      renderedShowDescriptions,
      labelFontSize,
    )
  }

  // Box around a resolved top-level feature; selection and search-highlight share
  // the same 2px inset box (label width reserved), differing only in color/tint.
  // No-op when the id isn't currently rendered.
  const addFeatureBox = (
    featureId: string,
    boxStyle: CSSProperties,
    key: string,
    testId?: string,
  ) => {
    const entry = featureItemMap.get(featureId)
    if (entry) {
      addOverlay({
        item: entry.item,
        source: entry.vr,
        boxStyle,
        key,
        extraWidth: computeExtraWidth(entry),
        xPadding: 2,
        yPadding: 2,
        yOffset: morphOffsetFor(featureId),
        testId,
      })
    }
  }

  const hoverItem = hoveredSubfeature ?? hoveredFeature
  if (hoverItem) {
    const entry = featureItemMap.get(hoverItem.featureId)
    if (entry) {
      // A feature's hit box is padded by HIT_PAD_PX and reserves label width
      // (buildFeatureFlatbushIndex); a subfeature's is neither
      // (buildSubfeatureFlatbushIndex), so its shading must mirror that exact,
      // unpadded box rather than overhang it.
      const subfeatureHover = !!hoveredSubfeature
      addOverlay({
        item: hoverItem,
        source: entry.vr,
        boxStyle: boxStyles.hover,
        key: 'hover',
        extraWidth: subfeatureHover ? 0 : computeExtraWidth(entry),
        xPadding: subfeatureHover ? 0 : HIT_PAD_PX,
        yOffset: morphOffsetFor(hoverItem.featureId),
      })
    }
  }

  // Solo collection in progress: dashed box each ctrl+clicked feature so the
  // "N selected" set is visible on the track, not just as a corner count.
  // Skipped once applied (the view then shows only these features anyway).
  if (!soloApplied) {
    for (const featureId of soloFeatureIdSet) {
      addFeatureBox(
        featureId,
        boxStyles.solo,
        `solo-select-${featureId}`,
        'feature-solo-select',
      )
    }
  }

  // Search highlights: box + tint the specific matched feature(s). Drawn before
  // selection so a click's selection border still reads on top.
  for (const featureId of highlightedFeatureIdSet) {
    addFeatureBox(
      featureId,
      boxStyles.searchHighlight,
      `search-highlight-${featureId}`,
      'feature-highlight',
    )
  }

  if (selectedFeatureId) {
    addFeatureBox(selectedFeatureId, boxStyles.selected, 'selected')
  }

  // The absolute layer is emitted here rather than by the caller so an empty box
  // set renders nothing at all, instead of an empty full-size div.
  return overlays.length > 0 ? (
    <div className={classes.overlay}>{overlays}</div>
  ) : null
})
