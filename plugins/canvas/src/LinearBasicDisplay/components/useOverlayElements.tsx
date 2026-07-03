import { makeStyles } from '@jbrowse/core/util/tss-react'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { alpha, useTheme } from '@mui/material'

import { computeLabelExtraWidth } from './highlightUtils.ts'
import { HIT_PAD_PX } from './hitTesting.ts'
import { forEachDisplayLabel } from './labelPositioning.ts'
import {
  LABEL_FONT_SIZE,
  LABEL_OVERLAY_BACKGROUND,
} from './sharedRendererConstants.ts'

import type { FeatureItemEntry, VisibleRegion } from './hitTesting.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'

interface OverlayModel {
  showLabels: boolean
  effectiveShowDescriptions: boolean
  selectedFeatureId: string | undefined
  selectFeatureById: (
    featureId: string,
    subfeatureInfo: SubfeatureInfo | undefined,
    displayedRegionIndex: number,
  ) => void
}

interface HighlightModel {
  showLabels: boolean
  effectiveShowDescriptions: boolean
  selectedFeatureId: string | undefined
  hoveredFeature: FlatbushItem | null
  hoveredSubfeature: SubfeatureInfo | null
  // uniqueIds of features resolved from a declarative search highlight
  highlightedFeatureIds: string[]
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
  // Labels re-derive their color from the theme here (rather than reusing the
  // worker's label.color, which the SVG export consumes) so a theme switch
  // recolors them instantly without re-running the worker. Description and
  // light-background overlay labels override the default below.
  floatingLabel: {
    position: 'absolute',
    fontSize: LABEL_FONT_SIZE,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    color: theme.palette.text.primary,
  },
  // theme-aware blue accent for descriptions — see theme.ts featureDescription
  floatingLabelDescription: {
    color: theme.palette.featureDescription,
  },
  floatingLabelClickable: {
    pointerEvents: 'auto',
    cursor: 'pointer',
  },
  floatingLabelStatic: {
    pointerEvents: 'none',
  },
  floatingLabelOverlay: {
    background: LABEL_OVERLAY_BACKGROUND,
    color: theme.palette.common.black,
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
  const { showLabels, effectiveShowDescriptions, selectFeatureById } = model

  if (!overlaysReady(viewInitialized, width, bpPerPx, visibleRegions)) {
    return null
  }

  const elements: React.ReactElement[] = []
  const visibility = {
    showLabels,
    showDescriptions: effectiveShowDescriptions,
  }

  forEachDisplayLabel(
    visibleRegions,
    renderDataMap,
    visibility,
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
              kind === 'desc' && classes.floatingLabelDescription,
            )}
            onClick={clickable ? handleLabelClick : undefined}
            onContextMenu={clickable ? handleLabelContextMenu : undefined}
            onMouseMove={clickable ? handleLabelMouseMove : undefined}
            style={{
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
    showLabels,
    effectiveShowDescriptions,
  } = model
  const theme = useTheme()
  // theme-aware (lightens on dark tracks, darkens on light) — see theme.ts
  const hoverColor = theme.palette.featureHover

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
    style: React.CSSProperties,
    key: string,
    extraWidth = 0,
    xPadding = 0,
    yPadding = 0,
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
            style={{
              position: 'absolute',
              left: rect.leftPx - xPadding,
              top: rect.topPx - yPadding,
              width: rect.width + extraWidth + xPadding * 2,
              height: rect.heightPx + yPadding * 2,
              pointerEvents: 'none',
              ...style,
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
      showLabels,
      effectiveShowDescriptions,
    )
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
        { backgroundColor: hoverColor },
        'hover',
        subfeatureHover ? 0 : computeExtraWidth(entry),
        subfeatureHover ? 0 : HIT_PAD_PX,
        0,
      )
    }
  }

  // Search highlights: box + tint the specific matched feature(s). Drawn before
  // selection so a click's selection border still reads on top.
  const highlightColor = theme.palette.highlight.main
  for (const featureId of highlightedFeatureIds) {
    const entry = featureItemMap.get(featureId)
    if (entry) {
      addOverlay(
        entry.item,
        entry.vr.refName,
        {
          border: `2px solid ${highlightColor}`,
          borderRadius: 3,
          backgroundColor: alpha(highlightColor, 0.25),
        },
        `search-highlight-${featureId}`,
        computeExtraWidth(entry),
        2,
        2,
      )
    }
  }

  if (selectedFeatureId) {
    const entry = featureItemMap.get(selectedFeatureId)
    if (entry) {
      addOverlay(
        entry.item,
        entry.vr.refName,
        {
          border: `2px solid ${theme.palette.featureSelected}`,
          borderRadius: 3,
        },
        'selected',
        computeExtraWidth(entry),
        2,
        2,
      )
    }
  }

  return overlays.length > 0 ? overlays : null
}
