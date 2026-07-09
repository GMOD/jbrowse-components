import { makeStyles } from '@jbrowse/core/util/tss-react'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { alpha } from '@mui/material'

import { computeLabelExtraWidth, computeOverlayRect } from './highlightUtils.ts'
import { HIT_PAD_PX } from './hitTesting.ts'
import { forEachDisplayLabel } from './labelPositioning.ts'
import { LABEL_OVERLAY_BACKGROUND } from './sharedRendererConstants.ts'

import type { FeatureItemEntry, VisibleRegion } from './hitTesting.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'

interface OverlayModel {
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  labelFontSize: number
  selectedFeatureId: string | undefined
  selectFeatureById: (
    featureId: string,
    subfeatureInfo: SubfeatureInfo | undefined,
    displayedRegionIndex: number,
  ) => void
}

interface HighlightModel {
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  selectedFeatureId: string | undefined
  hoveredFeature: FlatbushItem | null
  hoveredSubfeature: SubfeatureInfo | null
  // uniqueIds of features resolved from a declarative search highlight
  highlightedFeatureIds: string[]
  // the "show only these features" collection and whether it's isolating yet.
  // While collecting (not applied) each member is boxed so ctrl+click has
  // visual feedback; once applied the view already shows only these, so the
  // boxes would be redundant noise.
  soloFeatureIdSet: ReadonlySet<string>
  soloApplied: boolean
}

// Shared gate for both overlay builders: nothing to position until the view is
// sized and at least one region is on screen.
function overlaysReady(
  viewInitialized: boolean,
  width: number | undefined,
  bpPerPx: number,
  visibleRegions: VisibleRegion[],
) {
  return viewInitialized && !!width && !!bpPerPx && visibleRegions.length > 0
}

const useStyles = makeStyles()(theme => ({
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
  hoverOverlay: {
    backgroundColor: theme.palette.featureHover,
  },
  soloBox: {
    border: `2px dashed ${theme.palette.primary.main}`,
    borderRadius: 3,
    backgroundColor: alpha(theme.palette.primary.main, 0.15),
  },
  searchHighlightBox: {
    border: `1px solid ${alpha(theme.palette.highlight.main, 0.7)}`,
    borderRadius: 3,
    backgroundColor: alpha(theme.palette.highlight.main, 0.12),
  },
  selectedBox: {
    border: `2px solid ${theme.palette.featureSelected}`,
    borderRadius: 3,
  },
}))

export function useFloatingLabels(
  renderDataMap: Map<number, FeatureDataResult>,
  featureItemMap: Map<string, FeatureItemEntry>,
  visibleRegions: VisibleRegion[],
  viewInitialized: boolean,
  width: number | undefined,
  bpPerPx: number,
  model: OverlayModel,
  openContextMenu: (
    feature: FlatbushItem,
    displayedRegionIndex: number,
    clientX: number,
    clientY: number,
  ) => void,
  onLabelMouseOver?: (
    item: FlatbushItem,
    displayedRegionIndex: number,
    e: React.MouseEvent,
  ) => void,
) {
  const { classes, cx } = useStyles()
  const { renderedShowLabels, renderedShowDescriptions, labelFontSize, selectFeatureById } =
    model

  if (!overlaysReady(viewInitialized, width, bpPerPx, visibleRegions)) {
    return null
  }

  const elements: React.ReactElement[] = []
  const context = {
    showLabels: renderedShowLabels,
    showDescriptions: renderedShowDescriptions,
    fontSize: labelFontSize,
  }

  forEachDisplayLabel(
    visibleRegions,
    renderDataMap,
    context,
    (featureId, labels, vr) => {
      const displayedRegionIndex = vr.displayedRegionIndex
      const entry = featureItemMap.get(featureId)
      const item = entry?.kind === 'feature' ? entry.item : undefined
      // Allocate handler closures once per feature (not per-label); skip
      // entirely when there's no clickable item.
      const handleLabelClick = item
        ? () => {
            selectFeatureById(item.featureId, undefined, displayedRegionIndex)
          }
        : undefined
      const handleLabelContextMenu = item
        ? (e: React.MouseEvent) => {
            e.preventDefault()
            openContextMenu(item, displayedRegionIndex, e.clientX, e.clientY)
          }
        : undefined
      const handleLabelMouseMove =
        item && onLabelMouseOver
          ? (e: React.MouseEvent) => {
              onLabelMouseOver(item, displayedRegionIndex, e)
            }
          : undefined

      for (const { label, labelX, labelY, kind } of labels) {
        // A label is clickable iff it resolves to a top-level feature we can
        // open. Description labels are included: for variants with no ID the
        // description ("C -> T") is the only visible label, and a user
        // clicking it expects the feature details. Keying off the handler
        // (not the kind) also avoids rendering an inert pointer-cursor label
        // whose onClick is undefined.
        const clickable = !!handleLabelClick
        elements.push(
          <div
            key={`${displayedRegionIndex}-${featureId}-${kind}`}
            data-testid={
              clickable ? `feature-${kind}-${label.text}` : undefined
            }
            className={cx(
              classes.floatingLabel,
              clickable
                ? classes.floatingLabelClickable
                : classes.floatingLabelStatic,
              label.isOverlay && classes.floatingLabelOverlay,
            )}
            onClick={clickable ? handleLabelClick : undefined}
            onContextMenu={clickable ? handleLabelContextMenu : undefined}
            onMouseMove={clickable ? handleLabelMouseMove : undefined}
            style={{
              color: label.color,
              fontSize: labelFontSize,
              transform: `translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label.text}
          </div>,
        )
      }
    },
  )

  return elements.length > 0 ? elements : null
}

export function useHighlightOverlays(
  featureItemMap: Map<string, FeatureItemEntry>,
  visibleRegions: VisibleRegion[],
  viewInitialized: boolean,
  width: number | undefined,
  bpPerPx: number,
  model: HighlightModel,
) {
  const {
    hoveredFeature,
    hoveredSubfeature,
    selectedFeatureId,
    highlightedFeatureIds,
    soloFeatureIdSet,
    soloApplied,
    renderedShowLabels,
    renderedShowDescriptions,
  } = model
  const { classes, cx } = useStyles()

  if (!overlaysReady(viewInitialized, width, bpPerPx, visibleRegions)) {
    return null
  }

  const overlays: React.ReactElement[] = []

  const getItemRect = (
    item: {
      startBp: number
      endBp: number
      topPx: number
      bottomPx: number
    },
    vr: VisibleRegion,
  ) => {
    if (item.endBp < vr.start || item.startBp > vr.end) {
      return undefined
    }
    const toScreen = makeBpMapper(vr)
    const px1 = toScreen(item.startBp)
    const px2 = toScreen(item.endBp)
    const leftPx = Math.max(vr.screenStartPx, Math.min(px1, px2))
    const rightPx = Math.min(vr.screenEndPx, Math.max(px1, px2))
    return {
      leftPx,
      width: rightPx - leftPx,
      topPx: item.topPx,
      heightPx: item.bottomPx - item.topPx,
    }
  }

  const addOverlay = (
    item: {
      startBp: number
      endBp: number
      topPx: number
      bottomPx: number
    },
    refName: string,
    className: string,
    key: string,
    extraWidth = 0,
    xPadding = 0,
    yPadding = 0,
    testId?: string,
  ) => {
    for (const vr of visibleRegions) {
      if (vr.refName !== refName) {
        continue
      }
      const rect = getItemRect(item, vr)
      if (rect) {
        overlays.push(
          <div
            key={`${key}-${vr.displayedRegionIndex}`}
            data-testid={testId}
            className={cx(classes.overlayBase, className)}
            style={computeOverlayRect(rect, extraWidth, xPadding, yPadding)}
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
    )
  }

  // Box around a resolved top-level feature; selection and search-highlight share
  // the same 2px inset box (label width reserved), differing only in color/tint.
  // No-op when the id isn't currently rendered.
  const addFeatureBox = (
    featureId: string,
    className: string,
    key: string,
    testId?: string,
  ) => {
    const entry = featureItemMap.get(featureId)
    if (entry) {
      addOverlay(
        entry.item,
        entry.vr.refName,
        className,
        key,
        computeExtraWidth(entry),
        2,
        2,
        testId,
      )
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
      addOverlay(
        hoverItem,
        entry.vr.refName,
        classes.hoverOverlay,
        'hover',
        subfeatureHover ? 0 : computeExtraWidth(entry),
        subfeatureHover ? 0 : HIT_PAD_PX,
        0,
      )
    }
  }

  // Solo collection in progress: dashed box each ctrl+clicked feature so the
  // "N selected" set is visible on the track, not just as a corner count.
  // Skipped once applied (the view then shows only these features anyway).
  if (!soloApplied) {
    for (const featureId of soloFeatureIdSet) {
      addFeatureBox(
        featureId,
        classes.soloBox,
        `solo-select-${featureId}`,
        'feature-solo-select',
      )
    }
  }

  // Search highlights: box + tint the specific matched feature(s). Drawn before
  // selection so a click's selection border still reads on top.
  for (const featureId of highlightedFeatureIds) {
    addFeatureBox(
      featureId,
      classes.searchHighlightBox,
      `search-highlight-${featureId}`,
      'feature-highlight',
    )
  }

  if (selectedFeatureId) {
    addFeatureBox(selectedFeatureId, classes.selectedBox, 'selected')
  }

  return overlays.length > 0 ? overlays : null
}
