import { useMemo } from 'react'

import { makeBpMapper } from '@jbrowse/core/gpu/canvas2dUtils'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import { computeLabelExtraWidth } from './highlightUtils.ts'
import { forEachRenderedLabel } from './labelPositioning.ts'
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
  selectedFeatureId: string | undefined
  hoveredFeature: FlatbushItem | null
  hoveredSubfeature: SubfeatureInfo | null
}

const useStyles = makeStyles()({
  floatingLabel: {
    position: 'absolute',
    fontSize: LABEL_FONT_SIZE,
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
  floatingLabelOverlay: {
    background: 'rgba(255,255,255,0.65)',
  },
  aminoAcid: {
    position: 'absolute',
    transform: 'translateX(-50%)',
    fontFamily: 'monospace',
    textShadow: '0 0 1px white',
    pointerEvents: 'none',
    userSelect: 'none',
    whiteSpace: 'nowrap',
    WebkitFontSmoothing: 'antialiased',
  },
})

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
  return useMemo(() => {
    if (!viewInitialized || !width || !bpPerPx || visibleRegions.length === 0) {
      return null
    }

    const elements: React.ReactElement[] = []
    const renderedLabels = new Set<string>()
    const visibility = {
      showLabels: model.showLabels,
      showDescriptions: model.effectiveShowDescriptions,
    }

    for (const vr of visibleRegions) {
      const data = laidOutDataMap.get(vr.displayedRegionIndex)
      if (!data?.floatingLabelsData) {
        continue
      }

      forEachRenderedLabel(data, vr, visibility, (featureId, labels) => {
        if (renderedLabels.has(featureId)) {
          return
        }
        renderedLabels.add(featureId)

        const entry = featureItemMap.get(featureId)
        const item = entry?.kind === 'feature' ? entry.item : undefined
        const handleLabelClick = item
          ? () => {
              model.selectFeatureById(item, undefined, vr.displayedRegionIndex)
            }
          : undefined
        const handleLabelContextMenu = item
          ? (e: React.MouseEvent) => {
              e.preventDefault()
              openContextMenu(
                item,
                vr.displayedRegionIndex,
                e.clientX,
                e.clientY,
              )
            }
          : undefined
        const handleLabelMouseMove = item
          ? (e: React.MouseEvent) => {
              onLabelMouseOver?.(item, e)
            }
          : undefined

        for (const { label, labelX, labelY, kind } of labels) {
          const clickable = kind !== 'desc'
          elements.push(
            <div
              key={`${vr.displayedRegionIndex}-${featureId}-${kind}`}
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
                transform: `translate(${labelX}px, ${labelY}px)`,
                color: label.color,
              }}
            >
              {label.text}
            </div>,
          )
        }
      })
    }

    return elements.length > 0 ? elements : null
  }, [
    laidOutDataMap,
    featureItemMap,
    viewInitialized,
    width,
    bpPerPx,
    visibleRegions,
    model,
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
      if (!data?.aminoAcidOverlay) {
        continue
      }

      const toScreen = makeBpMapper(vr)

      for (const [i, item] of data.aminoAcidOverlay.entries()) {
        if (item.endBp < vr.start || item.startBp > vr.end) {
          continue
        }

        const pxStart = toScreen(item.startBp)
        const pxEnd = toScreen(item.endBp)
        const fontSize = Math.min(item.heightPx, 16)
        const showIndex = Math.abs(pxEnd - pxStart) >= 20

        elements.push(
          <div
            key={`${vr.displayedRegionIndex}-${i}`}
            className={classes.aminoAcid}
            style={{
              left: (pxStart + pxEnd) / 2,
              top: item.topPx,
              height: item.heightPx,
              fontSize,
              lineHeight: `${item.heightPx}px`,
              color: item.isStopOrNonTriplet ? 'red' : 'black',
            }}
          >
            {item.aminoAcid}
            {showIndex ? item.proteinIndex + 1 : null}
          </div>,
        )
      }
    }

    return elements.length > 0 ? elements : null
  }, [laidOutDataMap, viewInitialized, width, bpPerPx, visibleRegions, classes])
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
  } = model
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
      padding = 0,
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
                left: rect.leftPx - padding,
                top: rect.topPx - padding,
                width: rect.width + extraWidth + padding * 2,
                height: rect.heightPx + padding * 2,
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
      const blockBpPerPx =
        (entry.vr.end - entry.vr.start) /
        (entry.vr.screenEndPx - entry.vr.screenStartPx)
      const featureWidthPx =
        (entry.item.endBp - entry.item.startBp) / blockBpPerPx
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
        const extraWidth =
          hoveredFeature && !hoveredSubfeature ? computeExtraWidth(entry) : 0
        addOverlay(
          hoverItem,
          entry.vr.refName,
          { backgroundColor: 'rgba(0, 0, 0, 0.15)' },
          'hover',
          extraWidth,
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
  ])
}
