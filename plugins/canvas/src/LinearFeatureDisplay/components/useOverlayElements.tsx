import { useMemo } from 'react'

import { computeLabelExtraWidth } from './highlightUtils.ts'
import { shouldRenderPeptideText } from '../../RenderFeatureDataRPC/zoomThresholds.ts'

import type { VisibleRegion } from './hitTesting.ts'
import type {
  FeatureDataResult,
  FlatbushItem,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'

type FeatureItemEntry =
  | { item: FlatbushItem; vr: VisibleRegion; data: FeatureDataResult }
  | { item: SubfeatureInfo; vr: VisibleRegion }

interface OverlayModel {
  showLabels: boolean
  effectiveShowDescriptions: boolean
  selectedFeatureId: string | undefined
  selectFeatureById: (
    featureInfo: FlatbushItem,
    subfeatureInfo: SubfeatureInfo | undefined,
    regionNumber: number,
  ) => void
}

export function useFloatingLabels(
  rpcDataMap: Map<number, FeatureDataResult>,
  visibleRegions: VisibleRegion[],
  viewInitialized: boolean,
  width: number | undefined,
  bpPerPx: number,
  model: OverlayModel,
  openContextMenu: (
    feature: FlatbushItem,
    regionNumber: number,
    clientX: number,
    clientY: number,
  ) => void,
  onLabelMouseOver?: (
    item: FlatbushItem,
    e: React.MouseEvent,
  ) => void,
) {
  return useMemo(() => {
    if (!viewInitialized || !width || !bpPerPx || visibleRegions.length === 0) {
      return null
    }

    const elements: React.ReactElement[] = []
    const renderedLabels = new Set<string>()

    for (const vr of visibleRegions) {
      const data = rpcDataMap.get(vr.regionNumber)
      if (!data?.floatingLabelsData) {
        continue
      }

      const regionStart = data.regionStart
      const bpLength = vr.end - vr.start
      const screenWidth = vr.screenEndPx - vr.screenStartPx
      const bpToScreenPx = (bp: number) => {
        const frac = (bp - vr.start) / bpLength
        return vr.reversed
          ? vr.screenEndPx - frac * screenWidth
          : vr.screenStartPx + frac * screenWidth
      }

      const flatbushItemById = new Map<string, FlatbushItem>()
      for (const f of data.flatbushItems) {
        flatbushItemById.set(f.featureId, f)
      }

      for (const [featureId, labelData] of Object.entries(
        data.floatingLabelsData,
      )) {
        if (renderedLabels.has(featureId)) {
          continue
        }

        const featureStartBp = labelData.minX + regionStart
        const featureEndBp = labelData.maxX + regionStart

        if (featureEndBp < vr.start || featureStartBp > vr.end) {
          continue
        }

        renderedLabels.add(featureId)

        const px1 = bpToScreenPx(featureStartBp)
        const px2 = bpToScreenPx(featureEndBp)
        const featureLeftPx = Math.min(px1, px2)
        const featureRightPx = Math.max(px1, px2)
        const featureWidth = featureRightPx - featureLeftPx
        const featureBottomPx = labelData.topY + labelData.featureHeight

        const item = flatbushItemById.get(featureId)
        const handleLabelClick = item
          ? () => {
              model.selectFeatureById(item, undefined, vr.regionNumber)
            }
          : undefined

        const handleLabelContextMenu = item
          ? (e: React.MouseEvent) => {
              e.preventDefault()
              openContextMenu(item, vr.regionNumber, e.clientX, e.clientY)
            }
          : undefined

        const handleLabelMouseMove = item
          ? (e: React.MouseEvent) => {
              onLabelMouseOver?.(item, e)
            }
          : undefined

        const emitLabel = (
          label: {
            text: string
            relativeY: number
            color: string
            textWidth: number
            isOverlay?: boolean
          },
          padding: number,
          key: string,
          clickable?: boolean,
        ) => {
          const labelY = featureBottomPx + label.relativeY + padding
          const labelX =
            label.textWidth > featureWidth
              ? featureLeftPx
              : Math.min(
                  Math.max(Math.max(vr.screenStartPx, featureLeftPx), 0),
                  featureRightPx - label.textWidth,
                )

          elements.push(
            <div
              key={`${vr.regionNumber}-${featureId}-${key}`}
              data-testid={
                clickable ? `feature-${key}-${label.text}` : undefined
              }
              onClick={clickable ? handleLabelClick : undefined}
              onContextMenu={clickable ? handleLabelContextMenu : undefined}
              onMouseMove={clickable ? handleLabelMouseMove : undefined}
              style={{
                position: 'absolute',
                transform: `translate(${labelX}px, ${labelY}px)`,
                fontSize: 11,
                lineHeight: 1,
                color: label.color,
                pointerEvents: clickable ? 'auto' : 'none',
                cursor: clickable ? 'pointer' : undefined,
                whiteSpace: 'nowrap',
                ...(label.isOverlay
                  ? { background: 'rgba(255,255,255,0.65)' }
                  : undefined),
              }}
            >
              {label.text}
            </div>,
          )
        }

        if (labelData.nameLabel && model.showLabels) {
          emitLabel(labelData.nameLabel, 2, 'name', true)
        }
        if (labelData.descriptionLabel && model.effectiveShowDescriptions) {
          emitLabel(labelData.descriptionLabel, 2, 'desc')
        }
        if (labelData.subfeatureLabel) {
          emitLabel(labelData.subfeatureLabel, 0, 'sub', true)
        }
      }
    }

    return elements.length > 0 ? elements : null
  }, [
    rpcDataMap,
    viewInitialized,
    width,
    bpPerPx,
    visibleRegions,
    model,
    openContextMenu,
    onLabelMouseOver,
  ])
}

export function useAminoAcidOverlay(
  rpcDataMap: Map<number, FeatureDataResult>,
  visibleRegions: VisibleRegion[],
  viewInitialized: boolean,
  width: number | undefined,
  bpPerPx: number,
) {
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
      const data = rpcDataMap.get(vr.regionNumber)
      if (!data?.aminoAcidOverlay) {
        continue
      }

      const bpLength = vr.end - vr.start
      const sw = vr.screenEndPx - vr.screenStartPx
      const toScreen = (bp: number) => {
        const frac = (bp - vr.start) / bpLength
        return vr.reversed
          ? vr.screenEndPx - frac * sw
          : vr.screenStartPx + frac * sw
      }

      for (const [i, item] of data.aminoAcidOverlay.entries()) {
        if (item.endBp < vr.start || item.startBp > vr.end) {
          continue
        }

        const centerPx = (toScreen(item.startBp) + toScreen(item.endBp)) / 2
        const topPx = item.topPx
        const fontSize = Math.min(item.heightPx - 2, 12)

        elements.push(
          <div
            key={`${vr.regionNumber}-${i}`}
            style={{
              position: 'absolute',
              left: centerPx,
              top: topPx,
              height: item.heightPx,
              transform: 'translateX(-50%)',
              fontSize,
              lineHeight: `${item.heightPx}px`,
              color: item.isStopOrNonTriplet ? 'red' : 'black',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {item.aminoAcid}
            {item.proteinIndex + 1}
          </div>,
        )
      }
    }

    return elements.length > 0 ? elements : null
  }, [rpcDataMap, viewInitialized, width, bpPerPx, visibleRegions])
}

export function useHighlightOverlays(
  featureItemMap: Map<string, FeatureItemEntry>,
  visibleRegions: VisibleRegion[],
  viewInitialized: boolean,
  width: number | undefined,
  bpPerPx: number,
  hoveredFeature: FlatbushItem | null,
  hoveredSubfeature: SubfeatureInfo | null,
  selectedFeatureId: string | undefined,
  effectiveShowDescriptions: boolean,
) {
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
      const bpLength = vr.end - vr.start
      const sw = vr.screenEndPx - vr.screenStartPx
      const toScreen = (bp: number) => {
        const frac = (bp - vr.start) / bpLength
        return vr.reversed
          ? vr.screenEndPx - frac * sw
          : vr.screenStartPx + frac * sw
      }
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
              key={`${key}-${vr.regionNumber}`}
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
      if (entry.item.kind !== 'feature') {
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
    effectiveShowDescriptions,
  ])
}
