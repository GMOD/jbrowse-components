import { useId, useState } from 'react'

import { ScrollChrome } from '@jbrowse/core/ui'
import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { alpha } from '@jbrowse/core/ui/palette'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { usePanelVirtualScroll } from '@jbrowse/core/util/usePanelVirtualScroll'
import { GroupLabelChips } from '@jbrowse/display-kit/GroupLabelChips'
import { moveSectionOnto } from '@jbrowse/display-kit/groupByMenu'
import {
  GROUP_LABEL_FONT_SIZE,
  GROUP_LABEL_FONT_WEIGHT,
  GROUP_LABEL_HEIGHT,
  GROUP_LABEL_INSET_X,
  GROUP_LABEL_PADDING_X,
  GROUP_LABEL_RADIUS,
  GROUP_LABEL_TINT,
} from '@jbrowse/display-kit/groupLabelStyle'
import {
  paintFeatureBand,
  performMultiRegionHitDetection,
} from '@jbrowse/plugin-features/band'
import { containingLgv } from '@jbrowse/plugin-linear-genome-view'
import OverlayCanvas from '@jbrowse/render-core/OverlayCanvas'
import { observer } from 'mobx-react'

import { BandSeamHandle } from '../../shared/BandSeamHandle.tsx'
import { buildRecordHit } from './buildVariantHit.ts'
import { enrichFeatureFromClick } from './enrichFeatureFromClick.ts'
import { variantSurfaceHandlers } from './variantSurface.ts'

import type { LinearVariantDisplayModel } from '../model.ts'
import type { VariantTooltipFields } from './buildVariantHit.ts'
import type { VariantSurface } from './variantSurface.ts'
import type { HitFeatureResult } from '@jbrowse/plugin-features/band'

const useStyles = makeStyles()(theme => {
  const tint = alpha(theme.palette.text.primary, GROUP_LABEL_TINT)
  return {
    hiddenChip: {
      position: 'absolute',
      left: GROUP_LABEL_INSET_X,
      height: GROUP_LABEL_HEIGHT,
      padding: `0 ${GROUP_LABEL_PADDING_X}px`,
      border: 'none',
      borderRadius: GROUP_LABEL_RADIUS,
      fontSize: GROUP_LABEL_FONT_SIZE,
      fontWeight: GROUP_LABEL_FONT_WEIGHT,
      color: theme.palette.text.primary,
      backgroundColor: theme.palette.background.paper,
      backgroundImage: `linear-gradient(${tint}, ${tint})`,
      whiteSpace: 'nowrap',
      cursor: 'pointer',
    },
  }
})

interface RecordHit {
  fields: VariantTooltipFields
  hit: HitFeatureResult
}

/**
 * The record under the cursor, through plugin-features's own hit test, which
 * resolves overlap by paint order off the indexes built from the stack the
 * band painted. `mouseY` is relative to the band, which starts at the
 * display's top and does not scroll.
 */
function getHoveredRecord(
  model: LinearVariantDisplayModel,
  mouseX: number,
  mouseY: number,
): RecordHit | undefined {
  const result = performMultiRegionHitDetection(
    model.recordsLaidOutDataMap,
    model.recordsFlatbushIndexes,
    model.host.visibleRegions,
    mouseX,
    mouseY + model.recordsScrollTop,
  )
  const info = result && model.featureInfoById(result.feature.featureId)
  return result && info
    ? {
        fields: buildRecordHit({
          info,
          line: result.feature.tooltip,
          featureId: result.feature.featureId,
          displayedRegionIndex: result.displayedRegionIndex,
          carriers: model.recordCarriers.get(result.feature.featureId),
        }),
        hit: result,
      }
    : undefined
}

/**
 * The records band as a pointer surface, responding as a feature track's
 * features do: hover, click to the feature widget and right-click to the
 * record menu, the record lit while its menu is open, and a tooltip that
 * leaves out what the band's labels already say. A click names a record and
 * no sample, so the widget opens without a "Sample:" card.
 */
export function recordsBandSurface(
  model: LinearVariantDisplayModel,
): VariantSurface<RecordHit> {
  return {
    getHit: (x, y) => getHoveredRecord(model, x, y),
    getTooltip: hit => {
      const { fields } = hit
      const drawn = model.recordsDrawnLabelTexts(fields.featureId)
      const unlessDrawn = (text: string) => (drawn.has(text) ? '' : text)
      return {
        ...fields,
        featureName: unlessDrawn(fields.featureName),
        description: unlessDrawn(fields.description),
      }
    },
    bandRecordId: hit => hit.hit.feature.featureId,
    enrich: hit => {
      const { featureId } = hit.fields
      const baseFeature = model.featureById(featureId)
      return baseFeature
        ? enrichFeatureFromClick(baseFeature, model.featureInfoById(featureId))
        : undefined
    },
    onHover: hit => {
      model.setHoveredRecord(hit?.hit)
      model.setHoveredCell(undefined)
    },
  }
}

/**
 * The band's click targets, on a transparent layer over its canvas, since
 * `OverlayCanvas` is `pointerEvents: 'none'`. Its own observer reading the
 * hover, so a hover tick re-renders it and not the painted band. With no rows
 * the band is the display, and the wheel scrolls it as a feature track's
 * panel scrolls (`usePanelVirtualScroll`); over rows it scrolls nothing.
 */
const RecordsBandInteraction = observer(function RecordsBandInteraction({
  model,
  id,
}: {
  model: LinearVariantDisplayModel
  id: string
}) {
  const [panel, setPanel] = useState<HTMLDivElement | null>(null)
  const { canvasWidthPx, topBands, recordsOnly } = model
  usePanelVirtualScroll(
    recordsOnly ? panel : null,
    model,
    containingLgv(model).scrollZoom,
  )
  return (
    <div
      ref={setPanel}
      id={id}
      data-testid="records_band"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: canvasWidthPx,
        height: topBands.recordsHeight,
        cursor: model.hoveredRecord ? 'pointer' : undefined,
      }}
      {...variantSurfaceHandlers(model, recordsBandSurface(model))}
    />
  )
})

/**
 * Over rows, the count of records on screen that do not fit the band, at its
 * foot; a click raises the band to its whole stack.
 */
const HiddenRecordsChip = observer(function HiddenRecordsChip({
  model,
}: {
  model: LinearVariantDisplayModel
}) {
  const { classes } = useStyles()
  const count = model.recordsHiddenCount
  return count > 0 ? (
    <button
      type="button"
      data-testid="records_hidden_chip"
      className={classes.hiddenChip}
      style={{ top: model.topBands.recordsHeight - GROUP_LABEL_HEIGHT - 1 }}
      title="Records that do not fit the band. Click to show every row."
      onClick={() => {
        model.showAllRecordRows()
      }}
    >
      {`+${count.toLocaleString('en-US')} hidden`}
    </button>
  ) : null
})

/**
 * The record sections' chips (`records.facet`), as a feature track draws its
 * own: each pins to the band's top while its section scrolls past, and hides
 * its section or drags it onto another.
 */
const RecordsSectionChips = observer(function RecordsSectionChips({
  model,
}: {
  model: LinearVariantDisplayModel
}) {
  const { recordsGroupSections, recordsFacet, recordsScrollTop } = model
  const canHide = recordsGroupSections.length > 1
  return recordsFacet && recordsGroupSections.length > 0 ? (
    <GroupLabelChips
      canvasHeight={model.topBands.recordsHeight}
      hiddenCount={model.recordsHiddenGroups.size}
      onShowHidden={() => {
        model.showAllRecordsGroups()
      }}
      onMove={(key, ontoKey) => {
        moveSectionOnto(
          {
            sections: recordsGroupSections,
            domain: recordsFacet.sort,
            setDomain: domain => {
              model.setRecordsFacetSort(domain)
            },
          },
          key,
          ontoKey,
        )
      }}
      sections={recordsGroupSections.map(section => ({
        ...section,
        top: section.top - recordsScrollTop,
        onHide: canHide
          ? () => {
              model.hideRecordsGroup(section.key)
            }
          : undefined,
      }))}
    />
  ) : null
})

/**
 * The records band above the genotype rows, painted by plugin-features's
 * `paintFeatureBand` over the stack its packer laid out and its fit ladder
 * kept (`recordsFitStage`). Its own canvas, outside the rows' offset
 * container, because the rows scroll and the band does not. Every observable
 * the draw needs is read in the render body: `OverlayCanvas` calls `draw` from
 * an effect, where nothing is tracked.
 */
const RecordsBandOverlay = observer(function RecordsBandOverlay({
  model,
}: {
  model: LinearVariantDisplayModel
}) {
  const palette = usePalette()
  const id = useId()
  const {
    recordsLaidOutDataMap,
    recordsRenderedLabels,
    recordsFontSize,
    renderBlocks,
    topBands,
    canvasWidthPx,
    recordsScrollTop,
  } = model
  const { visibleRegions } = model.host
  const { recordsHeight } = topBands
  return recordsHeight > 0 ? (
    // sized, because every child is absolute and the seam handle spans its
    // parent's width: a 0px box leaves nothing to grab
    <div
      data-testid="records_band_box"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: canvasWidthPx,
        height: recordsHeight,
      }}
    >
      <OverlayCanvas
        width={canvasWidthPx}
        height={recordsHeight}
        draw={ctx => {
          paintFeatureBand(
            ctx,
            recordsLaidOutDataMap,
            renderBlocks,
            visibleRegions,
            {
              canvasWidth: canvasWidthPx,
              bandHeight: recordsHeight,
              scrollY: recordsScrollTop,
              ...recordsRenderedLabels,
              fontSize: recordsFontSize,
              palette,
            },
          )
        }}
      />
      <RecordsBandInteraction model={model} id={id} />
      <RecordsSectionChips model={model} />
      <HiddenRecordsChip model={model} />
      {model.recordsOnly ? (
        <ScrollChrome model={model} controlsId={id} />
      ) : null}
      {/* the target is the reserved height plus the delta, read in the
          callback, so a cap above the stack drags from what is drawn; with
          no rows the band is the display, resized by the track's own handle */}
      {model.recordsOnly ? null : (
        <BandSeamHandle
          data-testid="records_band_resize_handle"
          top={recordsHeight}
          title="Drag to resize the records band"
          onDrag={d => {
            const { recordsHeight } = model.topBands
            const cap = model.recordsMaxHeight
            // a band already as tall as its stack cannot grow, so a drag down
            // leaves the cap where it is rather than lowering it to the stack
            model.setRecordsMaxHeight(
              d > 0 && recordsHeight < cap ? cap : recordsHeight + d,
            )
          }}
        />
      )}
    </div>
  ) : null
})

export default RecordsBandOverlay
