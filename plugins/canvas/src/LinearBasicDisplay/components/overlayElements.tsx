import { usePalette } from '@jbrowse/core/ui/PaletteContext'
import { pluralize } from '@jbrowse/core/util'
import { eventPoint } from '@jbrowse/core/util/eventPoint'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { FloatingText } from '@jbrowse/display-ui'
import { observer } from 'mobx-react'

import {
  LABEL_BASELINE_RATIO,
  MORE_ISOFORMS_FONT_SCALE,
} from '../../RenderFeatureDataRPC/constants.ts'
import PeptideCanvas from './PeptideCanvas.tsx'
import { labelHit } from './hitTesting.ts'
import { htmlToPlainText } from './hoverReadout.ts'
import { labelColors } from './labelColors.ts'
import { forEachDisplayLabel, labelCullBand } from './labelPositioning.ts'
import { LABEL_OVERLAY_BACKGROUND } from './sharedRendererConstants.ts'

import type {
  FeatureDataResult,
  MoreIsoformsLabel,
  SubfeatureInfo,
} from '../../RenderFeatureDataRPC/rpcTypes.ts'
import type { LinearCanvasBaseDisplayModel } from '../baseModel.ts'
import type { FeatureContextMenuInfo } from '../featureContextMenu.ts'
import type {
  FeatureItemEntry,
  HitFeatureResult,
  VisibleRegion,
} from './hitTesting.ts'
import type {
  MoreResolvedLabel,
  PlainResolvedLabel,
} from './labelPositioning.ts'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

// The layer takes a narrow structural slice of the display, so a unit test can
// render it against a plain object; the guard below makes a renamed model field
// a compile error here rather than a silent undefined at runtime.
type AssignableTo<A extends B, B> = A

interface FloatingLabelsModel {
  renderedShowLabels: boolean
  renderedShowDescriptions: boolean
  renderedShowSubfeatureLabels: boolean
  canvasWidthPx: number
  renderedLabelFontSize: number
  height: number
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
  toggleExpandedGene: (featureId: string) => void
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _ModelSatisfiesFloatingLabels = AssignableTo<
  LinearCanvasBaseDisplayModel,
  FloatingLabelsModel
>

// The badge draws smaller than the name beside it and both divs position by their
// top, so aligning tops floats the badge's baseline above the name's and it reads
// as a superscript. `labelY` stays the shared line's top, which is what the SVG
// export converts from.
function moreBadgeTop(labelY: number, fontSize: number) {
  return (
    labelY + fontSize * (1 - MORE_ISOFORMS_FONT_SCALE) * LABEL_BASELINE_RATIO
  )
}

// A native title rather than the model hover the rest of the layer sets: that one
// describes the feature, and this is the layer's one control.
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

// The only label here that is a control. It stays clickable whether or not its
// gene resolves to an openable feature, since expanding reads the id straight off
// the attribute.
function MoreIsoformsBadge({
  resolved,
  featureId,
  displayedRegionIndex,
  renderedLabelFontSize,
  className,
}: {
  resolved: MoreResolvedLabel
  featureId: string
  displayedRegionIndex: number
  renderedLabelFontSize: number
  className: string
}) {
  const { label, labelX, labelY, color } = resolved
  return (
    <FloatingText
      title={moreIsoformsTitle(label)}
      data-testid={`feature-more-isoforms-${featureId}`}
      data-feature-id={featureId}
      data-more-isoforms=""
      data-region-index={displayedRegionIndex}
      className={className}
      x={labelX}
      y={moreBadgeTop(labelY, renderedLabelFontSize)}
      color={color}
      fontSize={renderedLabelFontSize * MORE_ISOFORMS_FONT_SCALE}
    >
      {label.text}
    </FloatingText>
  )
}

// Carries its ids as data attributes for the layer's delegated handlers, so
// rebuilding every label each frame allocates no per-label closure.
function FloatingLabel({
  resolved,
  featureId,
  displayedRegionIndex,
  renderedLabelFontSize,
  clickable,
  labelClasses,
}: {
  resolved: PlainResolvedLabel
  featureId: string
  displayedRegionIndex: number
  renderedLabelFontSize: number
  clickable: boolean
  labelClasses: LabelClasses
}) {
  const { label, labelX, labelY, color, kind } = resolved
  return (
    <FloatingText
      data-testid={clickable ? `feature-${kind}-${label.text}` : undefined}
      data-feature-id={clickable ? featureId : undefined}
      data-region-index={clickable ? displayedRegionIndex : undefined}
      className={
        labelClasses[clickable ? 'clickable' : 'static'][
          label.isOverlay ? 'overlay' : 'plain'
        ]
      }
      x={labelX}
      y={labelY}
      color={color}
      fontSize={renderedLabelFontSize}
    >
      {label.text}
    </FloatingText>
  )
}

function overlaysReady(
  viewInitialized: boolean,
  width: number | undefined,
  bpPerPx: number,
  visibleRegions: VisibleRegion[],
) {
  return viewInitialized && !!width && !!bpPerPx && visibleRegions.length > 0
}

const useStyles = makeStyles()(() => {
  return {
    // pointerEvents:none lets mouse events fall through to the canvas everywhere
    // but over a clickable label, which re-enables them and bubbles up to this
    // layer's delegated handlers.
    labelLayer: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
    },
    floatingLabelClickable: {
      pointerEvents: 'auto',
      cursor: 'pointer',
    },
    floatingLabelStatic: {
      pointerEvents: 'none',
    },
    // The underline and the pointer are what keep the badge from receding into
    // the name it annotates: it is an affordance, not a readout.
    floatingLabelMore: {
      pointerEvents: 'auto',
      cursor: 'pointer',
      fontStyle: 'italic',
      textDecoration: 'underline',
    },
    floatingLabelOverlay: {
      background: LABEL_OVERLAY_BACKGROUND,
    },
  }
})

// Its own observer: nothing here reads the cursor, so a mouse move never re-runs
// the per-feature label build. Labels follow the animated rows and move with the
// glyphs through a layout transition, while hit-testing uses the destination rows.
export const FloatingLabelsLayer = observer(function FloatingLabelsLayer({
  model,
  view,
  onLabelMouseOver,
  onLabelMouseLeave,
}: {
  model: FloatingLabelsModel
  view: LGV
  onLabelMouseOver?: (hit: HitFeatureResult) => void
  onLabelMouseLeave?: () => void
}) {
  const { classes, cx } = useStyles()
  const palette = usePalette()
  const {
    renderedShowLabels,
    renderedShowDescriptions,
    renderedLabelFontSize,
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
  const visibleRegions = view.visibleRegions

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
    fontSize: renderedLabelFontSize,
    colors: labelColors(palette),
  }
  const cullBand = labelCullBand(labelScrollBucket, height)

  // emotion's cx re-serializes and re-hashes the combined style on every call, and
  // only these four combinations exist, so they resolve once per render rather
  // than once per label on a path that rebuilds every label each frame.
  const labelClass = (clickable: boolean, isOverlay: boolean) =>
    cx(
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
  const moreBadgeClass = classes.floatingLabelMore

  forEachDisplayLabel(
    visibleRegions,
    renderDataMap,
    context,
    (featureId, labels, vr) => {
      const displayedRegionIndex = vr.displayedRegionIndex
      // Description labels count too: a variant with no ID shows its description
      // ("C -> T") as the only label, and clicking it has to open the details.
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
              renderedLabelFontSize={renderedLabelFontSize}
              className={moreBadgeClass}
            />
          ) : (
            <FloatingLabel
              key={key}
              resolved={resolved}
              featureId={featureId}
              displayedRegionIndex={displayedRegionIndex}
              renderedLabelFontSize={renderedLabelFontSize}
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

  // One delegated handler set for the whole layer, resolving the label under the
  // cursor at event time, so the per-frame rebuild creates no per-label closure.
  const labelElementAt = (e: React.MouseEvent) =>
    e.target instanceof HTMLElement
      ? e.target.closest<HTMLElement>('[data-feature-id]')
      : null

  // Answered off the badge's own marker rather than `featureItemMap`, because
  // expanding a gene needs nothing but its id.
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
        // Checked ahead of the feature paths: the badge carries a feature id of
        // its own, so a click on it would otherwise open the gene's details.
        const geneId = resolveMoreIsoforms(e)
        if (geneId !== undefined) {
          toggleExpandedGene(geneId)
          return
        }
        const t = resolveTarget(e)
        if (t) {
          // A label sits on its feature, so a ctrl+click landing on the name
          // rather than the glyph has to mean what it means on the glyph.
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
          // A click on a name gives no base to read a transcript off, so the
          // menu gets no HGVS position.
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
        // The badge would otherwise raise the gene's tooltip on top of its own
        // `title`. It clears rather than returns, because the cursor reached the
        // badge across the name it sits after, which already set the hover.
        if (resolveMoreIsoforms(e) !== undefined) {
          onLabelMouseLeave?.()
          return
        }
        const t = resolveTarget(e)
        const vr =
          t &&
          visibleRegions.find(
            r => r.displayedRegionIndex === t.displayedRegionIndex,
          )
        if (t && vr && onLabelMouseOver) {
          onLabelMouseOver(labelHit(t.item, vr, eventPoint(e).x))
        }
      }}
      // Leaving a label for anywhere but the canvas — off the track edge, out of
      // the window — reaches no canvas handler, so the label's hover would stay
      // lit. React dispatches the leave here even though the layer itself is
      // pointerEvents:none, the labels being its descendants.
      onMouseLeave={() => {
        onLabelMouseLeave?.()
      }}
    >
      {elements}
      {peptides}
    </div>
  )
})
