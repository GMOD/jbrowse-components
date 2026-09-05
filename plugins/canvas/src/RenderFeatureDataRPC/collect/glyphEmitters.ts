import { cssColorToABGR as colorToUint32 } from '@jbrowse/core/util/colorBits'

import { LITERAL } from '../colorClasses.ts'
import { createFeatureFloatingLabels } from '../floatingLabels.ts'
import { PAM_LABEL, findPamSubfeature } from '../glyphs/crisprGuide.ts'
import { collectPolyproteinCDS } from '../glyphs/matureProteinRegion.ts'
import { transcriptCoords } from '../glyphs/transcriptCoords.ts'
import {
  readFeatureLabels,
  readFeatureName,
  subfeatureLabelText,
} from '../labelUtils.ts'
import { featureType } from '../util.ts'
import {
  centerShrink,
  emitCodonRects,
  emitIntronLines,
  emitStrandArrow,
  emitSubfeatureLabel,
  emitTopLevelStrandArrow,
  pushBoxRect,
} from './emitPrimitives.ts'
import {
  CRISPR_PAM_COLOR,
  CUT_SITE_COLOR,
  MATURE_PROTEIN_COLORS,
  MATURE_PROTEIN_COLOR_HEX,
  REPEAT_BODY_HEIGHT_FRACTION,
  boxColor,
  featureTooltip,
  isRetrotransposonBody,
  repeatSubpartColor,
  strokeColor,
} from './glyphColors.ts'
import { aminoAcidsByFeature, aminoAcidsInRange } from './peptideMapping.ts'

import type { TranscriptCoords } from '../rpcTypes.ts'
import type { FeatureLayout, GlyphType } from '../types.ts'
import type {
  Collector,
  GlyphPlacement,
  RenderContext,
} from './renderContext.ts'
import type { Feature } from '@jbrowse/core/util'

function resolveSubfeatureLabel(feature: Feature, ctx: RenderContext) {
  return subfeatureLabelText(feature, ctx.config, ctx.jexl)
}

function emitExonRects(
  transcript: FeatureLayout,
  place: GlyphPlacement,
  ctx: RenderContext,
  collector: Collector,
) {
  const { baseTopPx, flatbushIdx, labelRowsAbove } = place
  const transcriptFeature = transcript.feature
  const aminoAcidsBySeg = aminoAcidsByFeature(transcriptFeature, ctx)
  // The residues are deduped and the CHILDREN are not, so two copies of one CDS
  // row resolve the same map entry and would emit every residue of it twice. A
  // repeat is skipped outright rather than falling through to the box below,
  // which would paint a flat rect over the codons it duplicates.
  const drawnSegments = new Set<string>()

  for (const childLayout of transcript.children) {
    const childFeature = childLayout.feature
    const childStart = childFeature.get('start')
    const childEnd = childFeature.get('end')

    // Segments key off CDS bounds, so a child that matches one is coding and
    // UTR sizing never applies on this branch.
    const key = `${childStart}-${childEnd}`
    const aminoAcids = aminoAcidsBySeg?.get(key)

    if (aminoAcids?.length) {
      if (drawnSegments.has(key)) {
        continue
      }
      drawnSegments.add(key)
      emitCodonRects(
        {
          aminoAcids,
          baseColor: boxColor(childFeature, ctx),
          topPx: baseTopPx,
          height: transcript.height,
          strand: transcriptFeature.get('strand') ?? 0,
          flatbushIdx,
          labelRowsAbove,
        },
        collector,
      )
    } else {
      pushBoxRect(
        {
          feature: childFeature,
          topPx: baseTopPx,
          height: transcript.height,
          flatbushIdx,
          labelRowsAbove,
        },
        ctx,
        collector,
      )
    }
  }
}

function processTranscriptLayout(
  transcript: FeatureLayout,
  place: GlyphPlacement,
  ctx: RenderContext,
  collector: Collector,
) {
  const {
    baseTopPx: transcriptTopPx,
    flatbushIdx,
    isRoot,
    parentFeature,
    labelRowsAbove,
  } = place
  const transcriptFeature = transcript.feature
  const stroke = strokeColor(transcriptFeature, ctx)

  emitIntronLines(
    {
      transcript,
      topPx: transcriptTopPx,
      labelRowsAbove,
      stroke,
      flatbushIdx,
      showChevrons: ctx.config.displayDirectionalChevrons,
    },
    collector,
  )

  emitExonRects(transcript, place, ctx, collector)

  // A standalone mRNA already has its own flatbush entry and name label, so
  // self-registering would double-draw the label and shadow its own tooltip.
  if (!isRoot) {
    registerSubfeature(
      {
        feature: transcriptFeature,
        parentFeatureId: parentFeature.id(),
        type: transcriptFeature.get('type'),
        topPx: transcriptTopPx,
        heightPx: transcript.height,
        labelRowsAbove,
        ownsLabelRow: transcript.ownsLabelRow,
        displayLabel: resolveSubfeatureLabel(transcriptFeature, ctx),
        transcript: transcriptCoords(transcript),
      },
      ctx,
      collector,
    )
  }

  emitStrandArrow(
    {
      feature: transcriptFeature,
      topPx: transcriptTopPx,
      height: transcript.height,
      stroke,
      flatbushIdx,
      labelRowsAbove,
    },
    collector,
  )
}

// Every glyph registers its children here rather than pushing the hit entry and
// the label itself, so the recorded metadata cannot drift between them.
function registerSubfeature(
  args: {
    feature: Feature
    parentFeatureId: string
    // The context menu's noun fallback keys on undefined, which `''` defeats.
    type: string | undefined
    topPx: number
    heightPx: number
    labelRowsAbove: number
    ownsLabelRow?: boolean
    displayLabel: string | undefined
    transcript?: TranscriptCoords
  },
  ctx: RenderContext,
  collector: Collector,
) {
  const { feature, parentFeatureId, type, topPx, heightPx, displayLabel } = args
  const { labelRowsAbove, ownsLabelRow, transcript } = args
  const startBp = feature.get('start')
  const endBp = feature.get('end')
  collector.subfeatureInfos.push({
    kind: 'subfeature',
    featureId: feature.id(),
    parentFeatureId,
    type,
    startBp,
    endBp,
    topPx,
    bottomPx: topPx + heightPx,
    labelRowsAbove,
    ownsLabelRow,
    displayLabel,
    transcript,
  })
  emitSubfeatureLabel(
    {
      featureId: feature.id(),
      displayLabel,
      featureHeight: heightPx,
      minX: startBp,
      maxX: endBp,
      topY: topPx,
      labelRowsAbove,
      parentFeatureId,
    },
    ctx,
    collector,
  )
}

// The strand arrow draws unconditionally, unlike a leaf glyph's: an enclosing
// gene renders as a Subfeatures container that draws none, so a nested
// polyprotein CDS would otherwise show no direction at all.
function processMatureProteinLayout(
  layout: FeatureLayout,
  place: GlyphPlacement,
  ctx: RenderContext,
  collector: Collector,
) {
  const { baseTopPx, flatbushIdx, parentFeature: rootFeature } = place
  const cdsFeature = layout.feature
  // Keyed on the CDS, not the enclosing gene: a gene can own two overlapping
  // polyproteins whose residues must not be stitched into one ORF.
  const byCdsSegment = aminoAcidsByFeature(cdsFeature, ctx)
  const aminoAcids = byCdsSegment && [...byCdsSegment.values()].flat()

  const cdsLabel = readFeatureName(ctx.config, cdsFeature, ctx.jexl)

  // Two polyprotein CDS children of one gene carry the same cleavage products at
  // identical coordinates, so their labels need the owning CDS to tell them
  // apart; a single-polyprotein gene would just repeat one suffix on every row.
  const disambiguateWithCds = collectPolyproteinCDS(rootFeature).length > 1

  for (const [i, childLayout] of layout.children.entries()) {
    const childFeature = childLayout.feature
    const topPx = baseTopPx + childLayout.y
    const labelRowsAbove =
      place.labelRowsAbove + (childLayout.labelRowsAbove ?? 0)
    const colorIdx = i % MATURE_PROTEIN_COLORS.length
    const cStart = childFeature.get('start')
    const cEnd = childFeature.get('end')
    const childAminoAcids =
      aminoAcids && aminoAcidsInRange(aminoAcids, cStart, cEnd)

    if (childAminoAcids?.length) {
      emitCodonRects(
        {
          aminoAcids: childAminoAcids,
          baseColor: {
            color: MATURE_PROTEIN_COLOR_HEX[colorIdx]!,
            colorClass: LITERAL,
          },
          topPx,
          height: childLayout.height,
          strand: cdsFeature.get('strand') ?? 0,
          flatbushIdx,
          labelRowsAbove,
        },
        collector,
      )
    } else {
      pushBoxRect(
        {
          feature: childFeature,
          topPx,
          height: childLayout.height,
          flatbushIdx,
          labelRowsAbove,
          colorOverride: MATURE_PROTEIN_COLORS[colorIdx],
        },
        ctx,
        collector,
      )
    }
    const childLabel = resolveSubfeatureLabel(childFeature, ctx)
    const displayLabel =
      disambiguateWithCds &&
      cdsLabel &&
      cdsLabel !== childLabel &&
      cdsLabel !== cdsFeature.id()
        ? `${childLabel} (${cdsLabel})`
        : childLabel

    registerSubfeature(
      {
        feature: childFeature,
        parentFeatureId: rootFeature.id(),
        type: featureType(childFeature),
        topPx,
        heightPx: childLayout.height,
        labelRowsAbove,
        ownsLabelRow: childLayout.ownsLabelRow,
        displayLabel,
      },
      ctx,
      collector,
    )
  }
  emitStrandArrow(
    {
      feature: layout.feature,
      topPx: baseTopPx,
      height: layout.height,
      stroke: strokeColor(layout.feature, ctx),
      flatbushIdx,
      labelRowsAbove: place.labelRowsAbove,
    },
    collector,
  )
}

// The subparts share one row and overlap, so the parent draws no box of its own
// — just the connecting line the children sit on.
function processRepeatRegionLayout(
  layout: FeatureLayout,
  place: GlyphPlacement,
  ctx: RenderContext,
  collector: Collector,
) {
  const { baseTopPx, flatbushIdx, labelRowsAbove } = place
  const { feature } = layout
  const stroke = strokeColor(feature, ctx)
  collector.lines.push({
    start: feature.get('start'),
    end: feature.get('end'),
    y: baseTopPx + layout.height / 2,
    height: layout.height,
    color: stroke.color,
    colorClass: stroke.colorClass,
    direction: 0,
    flatbushIdx,
    labelRowsAbove,
  })

  // The body draws first so the LTRs and TSDs that overlap it land on top.
  const sortedChildren = [...layout.children].sort((a, b) => {
    const aBody = isRetrotransposonBody(featureType(a.feature))
    const bBody = isRetrotransposonBody(featureType(b.feature))
    return aBody === bBody ? 0 : aBody ? -1 : 1
  })

  for (const childLayout of sortedChildren) {
    const childFeature = childLayout.feature
    const childType = featureType(childFeature)
    const [topPx, heightPx] = isRetrotransposonBody(childType)
      ? centerShrink(
          baseTopPx + childLayout.y,
          childLayout.height,
          REPEAT_BODY_HEIGHT_FRACTION,
        )
      : [baseTopPx + childLayout.y, childLayout.height]
    const color = repeatSubpartColor(childType)

    pushBoxRect(
      {
        feature: childFeature,
        topPx,
        height: heightPx,
        flatbushIdx,
        labelRowsAbove,
        colorOverride: color === undefined ? undefined : colorToUint32(color),
      },
      ctx,
      collector,
    )

    const displayLabel = resolveSubfeatureLabel(childFeature, ctx)
    registerSubfeature(
      {
        feature: childFeature,
        parentFeatureId: feature.id(),
        type: childType,
        topPx,
        heightPx,
        labelRowsAbove,
        displayLabel,
      },
      ctx,
      collector,
    )
  }

  emitTopLevelStrandArrow(layout, place, ctx, collector)
}

// Two pinned cuts draw half-height so the stagger between them reads as the
// enzyme's overhang; a single cut draws full-height, because half would imply a
// second cut nothing specified.
function pushCutTicks(
  args: {
    feature: Feature
    topPx: number
    height: number
    flatbushIdx: number
    labelRowsAbove: number
  },
  collector: Collector,
) {
  const {
    feature,
    topPx: baseTopPx,
    height,
    flatbushIdx,
    labelRowsAbove,
  } = args
  const strand = feature.get('strand') ?? 0
  const rawTop: unknown = feature.get('cutSite')
  const rawBottom: unknown = feature.get('cutSiteBottom')
  const topCut = typeof rawTop === 'number' ? rawTop : undefined
  const bottomCut = typeof rawBottom === 'number' ? rawBottom : undefined
  const pushCut = (at: number, y: number, cutHeight: number) => {
    collector.rects.push({
      start: at,
      end: at,
      y,
      height: cutHeight,
      color: CUT_SITE_COLOR,
      colorClass: LITERAL,
      strand,
      flatbushIdx,
      labelRowsAbove,
    })
  }
  if (topCut !== undefined && bottomCut !== undefined) {
    const half = height / 2
    pushCut(topCut, baseTopPx, half)
    pushCut(bottomCut, baseTopPx + half, half)
  } else {
    // Keyed on whichever cut exists, so a feature carrying only `cutSiteBottom`
    // still draws a tick.
    const soleCut = topCut ?? bottomCut
    if (soleCut !== undefined) {
      pushCut(soleCut, baseTopPx, height)
    }
  }
}

function processCrisprGuideLayout(
  layout: FeatureLayout,
  place: GlyphPlacement,
  ctx: RenderContext,
  collector: Collector,
) {
  const { baseTopPx, flatbushIdx, labelRowsAbove } = place
  const { feature, height } = layout
  const strand = feature.get('strand') ?? 0

  pushBoxRect(
    { feature, topPx: baseTopPx, height, flatbushIdx, labelRowsAbove },
    ctx,
    collector,
  )

  const pam = findPamSubfeature(feature)
  if (pam) {
    collector.rects.push({
      start: pam.get('start'),
      end: pam.get('end'),
      y: baseTopPx,
      height,
      color: CRISPR_PAM_COLOR,
      colorClass: LITERAL,
      strand,
      flatbushIdx,
      labelRowsAbove,
    })
    registerSubfeature(
      {
        feature: pam,
        parentFeatureId: feature.id(),
        type: 'PAM',
        topPx: baseTopPx,
        heightPx: height,
        labelRowsAbove,
        displayLabel: PAM_LABEL,
      },
      ctx,
      collector,
    )
  }

  pushCutTicks(
    { feature, topPx: baseTopPx, height, flatbushIdx, labelRowsAbove },
    collector,
  )

  emitTopLevelStrandArrow(layout, place, ctx, collector)
}

function processMotifLayout(
  layout: FeatureLayout,
  place: GlyphPlacement,
  ctx: RenderContext,
  collector: Collector,
) {
  const { baseTopPx, flatbushIdx, labelRowsAbove } = place
  const { feature, height } = layout

  pushBoxRect(
    { feature, topPx: baseTopPx, height, flatbushIdx, labelRowsAbove },
    ctx,
    collector,
  )
  pushCutTicks(
    { feature, topPx: baseTopPx, height, flatbushIdx, labelRowsAbove },
    collector,
  )

  emitTopLevelStrandArrow(layout, place, ctx, collector)
}

function emitBox(
  layout: FeatureLayout,
  place: GlyphPlacement,
  ctx: RenderContext,
  collector: Collector,
) {
  const { baseTopPx, flatbushIdx, isRoot, parentFeature, labelRowsAbove } =
    place
  const { feature, height } = layout
  pushBoxRect(
    { feature, topPx: baseTopPx, height, flatbushIdx, labelRowsAbove },
    ctx,
    collector,
  )
  if (isRoot) {
    emitTopLevelStrandArrow(layout, place, ctx, collector)
  } else {
    registerSubfeature(
      {
        feature,
        parentFeatureId: parentFeature.id(),
        // The raw slot, not featureType(): Box is the glyph a typeless child
        // lands on, and `''` would slip past the context menu's noun fallback.
        type: feature.get('type'),
        topPx: baseTopPx,
        heightPx: height,
        labelRowsAbove,
        // `Box` labels itself, so a leaf child of a gene spends its own `below`
        // row and the parent's `labelRows` already counts it.
        ownsLabelRow: layout.ownsLabelRow,
        displayLabel: resolveSubfeatureLabel(feature, ctx),
      },
      ctx,
      collector,
    )
  }
}

// Forwards `place.parentFeature` rather than its own `layout.feature`, so a
// grandchild under a nested container still registers against the record's root
// instead of the intermediate container.
function emitSubfeaturesGlyph(
  layout: FeatureLayout,
  place: GlyphPlacement,
  ctx: RenderContext,
  collector: Collector,
) {
  for (const [ordinal, child] of layout.children.entries()) {
    const mark = place.isRoot ? markCollector(collector) : undefined
    emitGlyph(
      child,
      {
        baseTopPx: place.baseTopPx + child.y,
        labelRowsAbove: place.labelRowsAbove + (child.labelRowsAbove ?? 0),
        flatbushIdx: place.flatbushIdx,
        isRoot: false,
        parentFeature: place.parentFeature,
      },
      ctx,
      collector,
    )
    if (mark) {
      stampChildOrdinal(collector, mark, ordinal)
    }
  }
}

type CollectorMark = ReturnType<typeof markCollector>

function markCollector(collector: Collector) {
  return {
    rects: collector.rects.length,
    lines: collector.lines.length,
    arrows: collector.arrows.length,
    subfeatureInfos: collector.subfeatureInfos.length,
    aminoAcidOverlay: collector.aminoAcidOverlay.length,
  }
}

// Stamps the emitted RANGE rather than threading the ordinal through every
// emitter, which is what makes it hold at depth: a grandchild lands inside its
// root child's range whatever `parentFeatureId` it registers under, and that
// linkage aliases every depth to the root.
function stampChildOrdinal(
  collector: Collector,
  mark: CollectorMark,
  ordinal: number,
) {
  for (let i = mark.rects; i < collector.rects.length; i++) {
    collector.rects[i]!.childOrdinal = ordinal
  }
  for (let i = mark.lines; i < collector.lines.length; i++) {
    collector.lines[i]!.childOrdinal = ordinal
  }
  for (let i = mark.arrows; i < collector.arrows.length; i++) {
    collector.arrows[i]!.childOrdinal = ordinal
  }
  for (
    let i = mark.subfeatureInfos;
    i < collector.subfeatureInfos.length;
    i++
  ) {
    const info = collector.subfeatureInfos[i]!
    info.childOrdinal = ordinal
    const label = collector.floatingLabelsData.get(info.featureId)
    if (label) {
      label.childOrdinal = ordinal
    }
  }
  for (
    let i = mark.aminoAcidOverlay;
    i < collector.aminoAcidOverlay.length;
    i++
  ) {
    collector.aminoAcidOverlay[i]!.childOrdinal = ordinal
  }
}

type GlyphEmitter = (
  layout: FeatureLayout,
  place: GlyphPlacement,
  ctx: RenderContext,
  collector: Collector,
) => void

// Keyed by `GlyphType`, so a new glyph type is a compile error here until it
// names an emitter.
const GLYPH_EMITTERS: Record<GlyphType, GlyphEmitter> = {
  Subfeatures: emitSubfeaturesGlyph,
  ProcessedTranscript: processTranscriptLayout,
  Segments: processTranscriptLayout,
  MatureProteinRegion: processMatureProteinLayout,
  RepeatRegion: processRepeatRegionLayout,
  Motif: processMotifLayout,
  CrisprGuide: processCrisprGuideLayout,
  Box: emitBox,
}

function emitGlyph(
  layout: FeatureLayout,
  place: GlyphPlacement,
  ctx: RenderContext,
  collector: Collector,
) {
  GLYPH_EMITTERS[layout.glyphType](layout, place, ctx, collector)
}

export function processFeatureRecord(
  layout: FeatureLayout,
  ctx: RenderContext,
  collector: Collector,
) {
  const { feature } = layout
  // A collapsed gene still carries a start/end spanning every hidden transcript,
  // so the label and hit box anchor to what actually drew rather than floating
  // over empty track.
  const drawn = layout.isoformsCollapsed ? layout.children : undefined
  const featureStart = drawn
    ? Math.min(...drawn.map(c => c.feature.get('start')))
    : feature.get('start')
  const featureEnd = drawn
    ? Math.max(...drawn.map(c => c.feature.get('end')))
    : feature.get('end')
  const strand = feature.get('strand') ?? 0

  const { name, description } = readFeatureLabels(ctx.config, feature, ctx.jexl)
  const { nameLabel, descriptionLabel } = createFeatureFloatingLabels({
    name,
    description,
  })

  if (nameLabel || descriptionLabel) {
    collector.floatingLabelsData.set(feature.id(), {
      featureId: feature.id(),
      minX: featureStart,
      maxX: featureEnd,
      topY: 0,
      featureHeight: layout.height,
      labelRows: layout.labelRows,
      nameLabel,
      descriptionLabel,
    })
  }

  collector.flatbushItems.push({
    kind: 'feature',
    featureId: feature.id(),
    type: feature.get('type'),
    startBp: featureStart,
    endBp: featureEnd,
    topPx: 0,
    bottomPx: layout.height,
    featureHeightPx: layout.height,
    tooltip: featureTooltip(feature, ctx),
    name,
    strand: strand !== 0 ? strand : undefined,
    // A standalone transcript registers no SubfeatureInfo, so its exon bounds
    // ride here instead.
    transcript: transcriptCoords(layout),
    // Fade eligibility, per feature — the per-rect decision is layout's alone.
    densityFade: layout.glyphType === 'Box',
    labelRows: layout.labelRows,
    isoformStack: layout.isoformStack,
  })
  const flatbushIdx = collector.flatbushItems.length - 1

  emitGlyph(
    layout,
    {
      baseTopPx: 0,
      labelRowsAbove: 0,
      flatbushIdx,
      isRoot: true,
      parentFeature: feature,
    },
    ctx,
    collector,
  )
}
