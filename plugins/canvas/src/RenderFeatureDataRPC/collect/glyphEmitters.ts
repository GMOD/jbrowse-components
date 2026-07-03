import { cssColorToABGR as colorToUint32 } from '@jbrowse/core/util/colorBits'

import { createFeatureFloatingLabels } from '../floatingLabels.ts'
import {
  getFeatureName,
  readFeatureLabels,
  readFeatureName,
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
  MATURE_PROTEIN_COLORS,
  MATURE_PROTEIN_COLOR_HEX,
  REPEAT_BODY_HEIGHT_FRACTION,
  REPEAT_COLOR_MAP,
  boxColor,
  featureTooltip,
  strokeColor,
} from './glyphColors.ts'
import { aminoAcidsByFeature, aminoAcidsInRange } from './peptideMapping.ts'

import type { Collector, RenderContext } from './renderContext.ts'
import type { FeatureLayout, GlyphType } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

function isContainerLayout(layout: FeatureLayout) {
  return (
    layout.glyphType === 'ProcessedTranscript' ||
    layout.glyphType === 'Segments'
  )
}

function emitExonRects(
  transcript: FeatureLayout,
  transcriptTopPx: number,
  ctx: RenderContext,
  flatbushIdx: number,
  collector: Collector,
) {
  const transcriptFeature = transcript.feature
  // exon path: CDS children align 1:1 with the translation segments, so each
  // child's residues are an exact `start-end` key lookup
  const aminoAcidsBySeg = aminoAcidsByFeature(transcriptFeature, ctx)

  for (const childLayout of transcript.children) {
    const childFeature = childLayout.feature
    const childStart = childFeature.get('start')
    const childEnd = childFeature.get('end')

    // amino-acid segments key off CDS bounds, so any child matching one is
    // coding — UTR sizing never applies on this branch
    const aminoAcids = aminoAcidsBySeg?.get(`${childStart}-${childEnd}`)

    if (aminoAcids?.length) {
      emitCodonRects(
        aminoAcids,
        boxColor(childFeature, ctx),
        transcriptTopPx,
        transcript.height,
        transcriptFeature.get('strand') ?? 0,
        flatbushIdx,
        collector.rects,
        collector.aminoAcidOverlay,
      )
    } else {
      pushBoxRect(
        childFeature,
        transcriptTopPx,
        transcript.height,
        flatbushIdx,
        ctx,
        collector.rects,
      )
    }
  }
}

function processTranscriptLayout(
  transcript: FeatureLayout,
  transcriptTopPx: number,
  parentFeature: Feature,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
) {
  const transcriptFeature = transcript.feature
  const strokeUint = colorToUint32(strokeColor(transcriptFeature, ctx))

  emitIntronLines(
    transcript,
    transcriptTopPx,
    strokeUint,
    flatbushIdx,
    collector.lines,
    ctx.config.displayDirectionalChevrons,
  )

  emitExonRects(transcript, transcriptTopPx, ctx, flatbushIdx, collector)

  // Transcript metadata: subfeature hit info + floating label
  const transcriptStart = transcriptFeature.get('start')
  const transcriptEnd = transcriptFeature.get('end')
  const transcriptType = transcriptFeature.get('type')
  const transcriptName = getFeatureName(transcriptFeature)

  collector.subfeatureInfos.push({
    kind: 'subfeature',
    featureId: transcriptFeature.id(),
    parentFeatureId: parentFeature.id(),
    type: transcriptType,
    startBp: transcriptStart,
    endBp: transcriptEnd,
    topPx: transcriptTopPx,
    bottomPx: transcriptTopPx + transcript.totalLayoutHeight,
    displayLabel: transcriptName,
  })

  emitSubfeatureLabel(
    {
      featureId: transcriptFeature.id(),
      displayLabel: transcriptName,
      featureHeight: transcript.height,
      minX: transcriptStart,
      maxX: transcriptEnd,
      topY: transcriptTopPx,
      parentFeatureId: parentFeature.id(),
    },
    ctx,
    collector,
  )

  emitStrandArrow(
    transcriptFeature,
    transcriptTopPx,
    transcript.height,
    strokeUint,
    flatbushIdx,
    collector.arrows,
  )
}

function processSubfeaturesLayout(
  layout: FeatureLayout,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
) {
  const { feature } = layout
  for (const childLayout of layout.children) {
    if (isContainerLayout(childLayout)) {
      processTranscriptLayout(
        childLayout,
        childLayout.y,
        feature,
        flatbushIdx,
        ctx,
        collector,
      )
    } else if (childLayout.glyphType === 'MatureProteinRegion') {
      // A polyprotein CDS nested under a container (gene → CDS → mature
      // regions); emit its stacked cleavage-product rows at the child's offset
      // rather than collapsing it to a single flat box. The container feature is
      // the top-level (root) feature for subfeature hit resolution, but the CDS
      // itself (childLayout.feature) is passed separately so its own product
      // name and reading frame are used, not the enclosing gene's.
      processMatureProteinLayout(
        childLayout,
        feature,
        childLayout.y,
        flatbushIdx,
        ctx,
        collector,
        childLayout.feature,
      )
    } else {
      pushBoxRect(
        childLayout.feature,
        childLayout.y,
        childLayout.height,
        flatbushIdx,
        ctx,
        collector.rects,
      )
    }
  }
}

// Viral polyproteins: a CDS whose mature_protein_region children tile the ORF,
// stacked in rows by layoutMatureProteinRegion. Each child already carries its
// own y/height; draw a strand arrow on the parent CDS when it is top-level so
// it shows direction like every other glyph. baseTopPx shifts the rows when the
// CDS is nested inside a container glyph (gene → CDS → mature regions).
// rootFeature is the top-level feature (the one GetCanvasFeatureDetails resolves
// by id, and the key into peptideDataMap — for a gene with multiple polyprotein
// CDS children, e.g. SARS-CoV-2 ORF1a/ORF1ab, translation is keyed at the gene
// level); each region is registered as a subfeature off it so it is individually
// Register a subfeature as both a hoverable/selectable hit-test entry and (when
// subfeatureLabels is enabled) a floating label, keyed by the child's own
// coordinates. Shared by the mature-protein and repeat-region glyph paths so the
// recorded metadata can't drift between them.
function registerSubfeature(
  args: {
    feature: Feature
    parentFeatureId: string
    type: string
    topPx: number
    heightPx: number
    displayLabel: string | undefined
  },
  ctx: RenderContext,
  collector: Collector,
) {
  const { feature, parentFeatureId, type, topPx, heightPx, displayLabel } = args
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
    displayLabel,
  })
  emitSubfeatureLabel(
    {
      featureId: feature.id(),
      displayLabel,
      featureHeight: heightPx,
      minX: startBp,
      maxX: endBp,
      topY: topPx,
      parentFeatureId,
    },
    ctx,
    collector,
  )
}

// hoverable and selectable. cdsFeature is the polyprotein CDS that directly owns
// the mature-region children — same object as rootFeature for a standalone CDS,
// but the immediate child layout's feature (not the enclosing gene) when nested,
// used only to resolve the right per-CDS product name for the label.
//
// When zoomed in far enough that peptide data is present, each region shows the
// amino-acid letters of its slice of the polyprotein. The protein is translated
// once from the whole ORF (keyed by rootFeature.id() in peptideDataMap), then
// each residue is assigned to the region containing its genomic start — so
// nested/overlapping cleavage products (e.g. VP0 over VP4+VP2) each get the
// residues they cover without double-translating or drifting out of frame.
function processMatureProteinLayout(
  layout: FeatureLayout,
  rootFeature: Feature,
  baseTopPx: number,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
  cdsFeature: Feature = rootFeature,
) {
  // one flat residue list for the whole ORF; the polyprotein CDS is a single
  // reading frame, so mature regions are sub-slices of it rather than the
  // segment-aligned children the exon path keys on
  const byCdsSegment = aminoAcidsByFeature(rootFeature, ctx)
  const aminoAcids = byCdsSegment && [...byCdsSegment.values()].flat()

  // loop-invariant: the owning CDS's config-jexl name, resolved once for all
  // cleavage products rather than per child
  const cdsLabel = readFeatureName(ctx.config, cdsFeature, ctx.jexl)

  for (const [i, childLayout] of layout.children.entries()) {
    const childFeature = childLayout.feature
    const topPx = baseTopPx + childLayout.y
    const colorIdx = i % MATURE_PROTEIN_COLORS.length
    const cStart = childFeature.get('start')
    const cEnd = childFeature.get('end')
    const childAminoAcids =
      aminoAcids && aminoAcidsInRange(aminoAcids, cStart, cEnd)

    if (childAminoAcids?.length) {
      emitCodonRects(
        childAminoAcids,
        MATURE_PROTEIN_COLOR_HEX[colorIdx]!,
        topPx,
        childLayout.height,
        rootFeature.get('strand') ?? 0,
        flatbushIdx,
        collector.rects,
        collector.aminoAcidOverlay,
      )
    } else {
      pushBoxRect(
        childFeature,
        topPx,
        childLayout.height,
        flatbushIdx,
        ctx,
        collector.rects,
        MATURE_PROTEIN_COLORS[colorIdx],
      )
    }
    // config-driven name so a `labels.name` override can surface e.g. the GFF
    // `product` attribute (mature peptides carry no `name`); falls back to the
    // plain name/id
    const childLabel =
      readFeatureName(ctx.config, childFeature, ctx.jexl) ??
      getFeatureName(childFeature)
    // viral polyproteins (e.g. SARS-CoV-2 ORF1a/ORF1ab) share cleavage products:
    // the same mature peptide (nsp1-nsp10) is a child of both polyprotein CDS
    // records at identical coordinates, so the box and its label legitimately
    // appear twice. When the owning CDS resolves a real name/product (not just
    // its bare id), append it so the two rows read as distinct ("nsp1 (ORF1a
    // polyprotein)" vs "nsp1 (ORF1ab polyprotein)") instead of looking like a
    // duplicate/bug.
    const displayLabel =
      cdsLabel && cdsLabel !== childLabel && cdsLabel !== cdsFeature.id()
        ? `${childLabel} (${cdsLabel})`
        : childLabel

    // mirror the transcript path so `subfeatureLabels` actually labels mature
    // peptides (matureProteinRegion glyph)
    registerSubfeature(
      {
        feature: childFeature,
        parentFeatureId: rootFeature.id(),
        type: childFeature.get('type'),
        topPx,
        heightPx: childLayout.height,
        displayLabel,
      },
      ctx,
      collector,
    )
  }
  emitTopLevelStrandArrow(layout, flatbushIdx, ctx, collector)
}

// Intact transposon (repeat_region): subparts on a single row, joined by one
// connecting line, with no box for the parent itself — like a transcript whose
// exons happen to overlap. The internal *_retrotransposon body is drawn first
// (underneath) and shortened so the full-height LTRs and TSDs that overlap it
// stay visible on top. Each subpart keeps its own type color and is registered
// as an individually hoverable subfeature. See GMOD/jbrowse-components#3080.
function processRepeatRegionLayout(
  layout: FeatureLayout,
  feature: Feature,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
) {
  const strokeUint = colorToUint32(strokeColor(feature, ctx))
  collector.lines.push({
    start: feature.get('start'),
    end: feature.get('end'),
    y: layout.height / 2,
    color: strokeUint,
    direction: 0,
    flatbushIdx,
  })

  // retrotransposon body underneath; LTRs/TSDs painted over it
  const sortedChildren = [...layout.children].sort((a, b) => {
    const aBody = featureType(a.feature).endsWith('_retrotransposon')
    const bBody = featureType(b.feature).endsWith('_retrotransposon')
    return aBody === bBody ? 0 : aBody ? -1 : 1
  })

  for (const childLayout of sortedChildren) {
    const childFeature = childLayout.feature
    const childType = featureType(childFeature)
    const isBody = childType.endsWith('_retrotransposon')
    const [topPx, heightPx] = isBody
      ? centerShrink(
          childLayout.y,
          childLayout.height,
          REPEAT_BODY_HEIGHT_FRACTION,
        )
      : [childLayout.y, childLayout.height]
    const color = REPEAT_COLOR_MAP[childType]

    pushBoxRect(
      childFeature,
      topPx,
      heightPx,
      flatbushIdx,
      ctx,
      collector.rects,
      color === undefined ? undefined : colorToUint32(color),
    )

    const displayLabel =
      readFeatureName(ctx.config, childFeature, ctx.jexl) ??
      getFeatureName(childFeature)
    registerSubfeature(
      {
        feature: childFeature,
        parentFeatureId: feature.id(),
        type: childType,
        topPx,
        heightPx,
        displayLabel,
      },
      ctx,
      collector,
    )
  }

  emitTopLevelStrandArrow(layout, flatbushIdx, ctx, collector)
}

function processDefaultLayout(
  layout: FeatureLayout,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
) {
  pushBoxRect(
    layout.feature,
    0,
    layout.height,
    flatbushIdx,
    ctx,
    collector.rects,
    undefined,
    true,
  )
  emitTopLevelStrandArrow(layout, flatbushIdx, ctx, collector)
}

// Top-level emit dispatch keyed by the glyphType the layout pass (glyphs/,
// selected by findGlyph) tagged each feature with. A Record (rather than a
// switch) makes the GlyphType union exhaustive: adding a glyph type without a
// handler here is a compile error. Each handler always emits at topPx 0; the
// nested offsets are handled by the recursive calls inside the processors.
type GlyphEmit = (
  layout: FeatureLayout,
  feature: Feature,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
) => void

const emitTranscript: GlyphEmit = (
  layout,
  feature,
  flatbushIdx,
  ctx,
  collector,
) => {
  processTranscriptLayout(layout, 0, feature, flatbushIdx, ctx, collector)
}

const GLYPH_EMITTERS: Record<GlyphType, GlyphEmit> = {
  Box: (layout, _feature, flatbushIdx, ctx, collector) => {
    processDefaultLayout(layout, flatbushIdx, ctx, collector)
  },
  ProcessedTranscript: emitTranscript,
  Segments: emitTranscript,
  Subfeatures: (layout, _feature, flatbushIdx, ctx, collector) => {
    processSubfeaturesLayout(layout, flatbushIdx, ctx, collector)
  },
  MatureProteinRegion: (layout, feature, flatbushIdx, ctx, collector) => {
    processMatureProteinLayout(layout, feature, 0, flatbushIdx, ctx, collector)
  },
  RepeatRegion: (layout, feature, flatbushIdx, ctx, collector) => {
    processRepeatRegionLayout(layout, feature, flatbushIdx, ctx, collector)
  },
}

export function processFeatureRecord(
  layout: FeatureLayout,
  ctx: RenderContext,
  collector: Collector,
) {
  const { feature } = layout
  const featureStart = feature.get('start')
  const featureEnd = feature.get('end')
  const strand = feature.get('strand') ?? 0

  const { name, description } = readFeatureLabels(ctx.config, feature, ctx.jexl)
  const { nameLabel, descriptionLabel } = createFeatureFloatingLabels({
    name,
    description,
    theme: ctx.theme,
  })

  if (nameLabel || descriptionLabel) {
    collector.floatingLabelsData[feature.id()] = {
      featureId: feature.id(),
      minX: featureStart,
      maxX: featureEnd,
      topY: 0,
      featureHeight: layout.height,
      nameLabel,
      descriptionLabel,
    }
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
    // Box is the only glyph that emits a density-fade rect (processDefaultLayout).
    densityFade: layout.glyphType === 'Box',
  })
  const flatbushIdx = collector.flatbushItems.length - 1

  GLYPH_EMITTERS[layout.glyphType](layout, feature, flatbushIdx, ctx, collector)
}
