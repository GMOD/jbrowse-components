import { useMemo } from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'
import { makeBpMapper } from '@jbrowse/render-core/canvas2dUtils'
import { useTheme } from '@mui/material'

import { computeLabelExtraWidth } from './highlightUtils.ts'
import { HIT_PAD_PX } from './hitTesting.ts'
import { forEachRenderedLabel } from './labelPositioning.ts'
import { forEachRenderedPeptide } from './peptidePositioning.ts'
import { LABEL_FONT_SIZE } from './sharedRendererConstants.ts'
import { shouldRenderPeptideText } from '../../RenderFeatureDataRPC/zoomThresholds.ts'

import type { FeatureItemEntry, VisibleRegion } from './hitTesting.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'

interface OverlayModel {
  showLabels: boolean
  effectiveShowDescriptions: boolean
  displayMode: string
  selectedFeatureId: string | undefined
  selectFeatureById: (
    featureInfo: FlatbushItem,
    subfeatureInfo: SubfeatureInfo | undefined,
    displayedRegionIndex: number,
  ) => void
}

interface HighlightModel {
  showLabels: boolean
  effectiveShowDescriptions: boolean
  displayMode: string
  selectedFeatureId: string | undefined
  hoveredFeature: FlatbushItem | null
  hoveredSubfeature: SubfeatureInfo | null
}

const useStyles = makeStyles()(theme => ({
  // Default label color is theme-responsive (white in dark mode) since the
  // worker-computed label.color is theme-blind. Description labels and the
  // light-background overlay labels override it below.
  floatingLabel: {
    position: 'absolute',
    fontSize: LABEL_FONT_SIZE,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    color: theme.palette.text.primary,
  },
  // Keep a blue accent for descriptions, but use a softer, lighter blue in dark
  // mode so it stays readable against the dark track background instead of the
  // old near-black CSS 'blue'.
  floatingLabelDescription: {
    color:
      theme.palette.mode === 'dark'
        ? theme.palette.info.light
        : theme.palette.info.main,
  },
  floatingLabelClickable: {
    pointerEvents: 'auto',
    cursor: 'pointer',
  },
  floatingLabelStatic: {
    pointerEvents: 'none',
  },
  floatingLabelOverlay: {
    background: 'rgba(255,255,255,0.65)',
    color: theme.palette.common.black,
  },
  aminoAcid: {
    position: 'absolute',
    transform: 'translateX(-50%)',
    fontFamily: 'monospace',
    textShadow: '0 0 2px white',
    pointerEvents: 'none',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    WebkitFontSmoothing: 'antialiased',
  },
}))

export function useFloatingLabels(
  laidOutDataMap: Map<number, FeatureDataResult>,
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
  onLabelMouseOver?: (item: FlatbushItem, e: React.MouseEvent) => void,
) {
  const { classes, cx } = useStyles()
  // Read observables outside useMemo so the memo cache invalidates when they
  // change. Inside useMemo, model.* reads only run on cache-miss; relying on
  // them to re-trigger would couple correctness to transitive recomputation
  // of laidOutDataMap (which happens to depend on the same flags). Mirrors
  // the destructure-before-useMemo pattern in useHighlightOverlays below.
  const {
    showLabels,
    effectiveShowDescriptions,
    displayMode,
    selectFeatureById,
  } = model
  const decimateLabels = displayMode === 'collapse'
  return useMemo(() => {
    if (!viewInitialized || !width || !bpPerPx || visibleRegions.length === 0) {
      return null
    }

    const elements: React.ReactElement[] = []
    const renderedLabels = new Set<string>()
    const visibility = {
      showLabels,
      showDescriptions: effectiveShowDescriptions,
    }

    for (const vr of visibleRegions) {
      const data = laidOutDataMap.get(vr.displayedRegionIndex)
      if (!data?.floatingLabelsData) {
        continue
      }

      const displayedRegionIndex = vr.displayedRegionIndex
      forEachRenderedLabel(
        data,
        vr,
        visibility,
        (featureId, labels) => {
          if (renderedLabels.has(featureId)) {
            return
          }
          renderedLabels.add(featureId)

          const entry = featureItemMap.get(featureId)
          const item = entry?.kind === 'feature' ? entry.item : undefined
          // Allocate handler closures once per feature (not per-label); skip
          // entirely when there's no clickable item.
          const handleLabelClick = item
            ? () => {
                selectFeatureById(item, undefined, displayedRegionIndex)
              }
            : undefined
          const handleLabelContextMenu = item
            ? (e: React.MouseEvent) => {
                e.preventDefault()
                openContextMenu(
                  item,
                  displayedRegionIndex,
                  e.clientX,
                  e.clientY,
                )
              }
            : undefined
          const handleLabelMouseMove =
            item && onLabelMouseOver
              ? (e: React.MouseEvent) => {
                  onLabelMouseOver(item, e)
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
        decimateLabels,
      )
    }

    return elements.length > 0 ? elements : null
  }, [
    laidOutDataMap,
    featureItemMap,
    viewInitialized,
    width,
    bpPerPx,
    visibleRegions,
    showLabels,
    effectiveShowDescriptions,
    decimateLabels,
    selectFeatureById,
    openContextMenu,
    onLabelMouseOver,
    classes,
    cx,
  ])
}

export function useAminoAcidOverlay(
  laidOutDataMap: Map<number, FeatureDataResult>,
  visibleRegions: VisibleRegion[],
  viewInitialized: boolean,
  width: number | undefined,
  bpPerPx: number,
) {
  const { classes } = useStyles()
  const theme = useTheme()

  // Memoized like the sibling overlay hooks: FeatureComponent is an observer
  // that re-renders on every mousemove (hover state), so without this the
  // amino-acid <div>s rebuild on each hover event while peptide text shows.
  return useMemo(() => {
    if (
      !viewInitialized ||
      !width ||
      !bpPerPx ||
      !shouldRenderPeptideText(bpPerPx) ||
      visibleRegions.length === 0
    ) {
      return null
    }

    const elements: React.ReactElement[] = []

    for (const vr of visibleRegions) {
      const data = laidOutDataMap.get(vr.displayedRegionIndex)
      if (!data) {
        continue
      }
      forEachRenderedPeptide(data, vr, (item, cell, i) => {
        elements.push(
          <div
            key={`${vr.displayedRegionIndex}-${i}`}
            className={classes.aminoAcid}
            style={{
              left: cell.centerPx,
              top: item.topPx,
              height: item.heightPx,
              fontSize: cell.fontSize,
              lineHeight: `${item.heightPx}px`,
              color: item.isStopOrNonTriplet
                ? theme.palette.error.main
                : theme.palette.text.primary,
            }}
          >
            {cell.text}
          </div>,
        )
      })
    }

    return elements.length > 0 ? elements : null
  }, [
    laidOutDataMap,
    visibleRegions,
    viewInitialized,
    width,
    bpPerPx,
    classes,
    theme,
  ])
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
    showLabels,
    effectiveShowDescriptions,
    displayMode,
  } = model
  const decimateLabels = displayMode === 'collapse'
  return useMemo(() => {
    if (!viewInitialized || !width || !bpPerPx || visibleRegions.length === 0) {
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
        !decimateLabels,
      )
    }

    const hoverItem = hoveredSubfeature ?? hoveredFeature
    if (hoverItem) {
      const entry = featureItemMap.get(hoverItem.featureId)
      if (entry) {
        const extraWidth =
          hoveredFeature && !hoveredSubfeature ? computeExtraWidth(entry) : 0
        addOverlay(
          hoverItem,
          entry.vr.refName,
          { backgroundColor: 'rgba(0, 0, 0, 0.15)' },
          'hover',
          extraWidth,
          HIT_PAD_PX,
          0,
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
            border: '2px solid rgba(0, 100, 255, 0.8)',
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
  }, [
    featureItemMap,
    viewInitialized,
    width,
    bpPerPx,
    visibleRegions,
    hoveredFeature,
    hoveredSubfeature,
    selectedFeatureId,
    showLabels,
    effectiveShowDescriptions,
    decimateLabels,
  ])
}
