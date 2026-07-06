import { cssColorToABGR as colorToUint32 } from '@jbrowse/core/util/colorBits'

import { createFeatureFloatingLabels } from '../floatingLabels.ts'
import { hasMatureProteinChildren } from '../glyphs/matureProteinRegion.ts'
import {
  getFeatureName,
  readFeatureLabels,
  readFeatureName,
} from '../labelUtils.ts'
import { featureType, getSubfeatures, isCDS } from '../util.ts'
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
  CRISPR_CUT_COLOR,
  CRISPR_PAM_COLOR,
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
import type { FeatureLayout } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Subfeature display label: the config-jexl `labels.name` slot (so a `product`
// override surfaces for mature peptides / repeat subparts that carry no `name`),
// falling back to the plain name/id. Shared by the mature-protein, repeat-region
// and stacked-box paths so their labels can't drift.
function resolveSubfeatureLabel(feature: Feature, ctx: RenderContext) {
  return readFeatureName(ctx.config, feature, ctx.jexl) ?? getFeatureName(feature)
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

// Viral polyproteins: a CDS whose mature_protein_region children tile the ORF,
// stacked in rows by layoutMatureProteinRegion. Each child already carries its
// own y/height; draw a strand arrow on the polyprotein CDS so it shows direction
// like the transcript path does. Drawn unconditionally (not parent-gated like
// leaf glyphs) because the enclosing gene renders as a Subfeatures container
// that draws no arrow of its own — so a nested CDS (gene → ORF1ab CDS → nsp*,
// and the enterovirus gene → CDS → mature peptides) would otherwise lose its
// direction entirely, unlike a gene → mRNA whose transcript always shows one.
// baseTopPx shifts the rows when the CDS is nested inside a container glyph.
// rootFeature is the top-level feature (the one GetCanvasFeatureDetails resolves
// by id, and the key into peptideDataMap — for a gene with multiple polyprotein
// CDS children, e.g. SARS-CoV-2 ORF1a/ORF1ab, translation is keyed at the gene
// level); each region is registered as a subfeature off it so it is individually
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

  // Only append the owning-CDS name to each peptide label when the peptide is
  // genuinely ambiguous — i.e. the enclosing gene has more than one polyprotein
  // CDS child that share cleavage products (SARS-CoV-2 ORF1a/ORF1ab both carry
  // nsp1–nsp10 at identical coords). A single-polyprotein gene (enterovirus, the
  // common case) or a standalone CDS has nothing to disambiguate, so suffixing
  // all 12 labels with "(genome polyprotein)" would be pure repeated clutter.
  const disambiguateWithCds =
    getSubfeatures(rootFeature).filter(
      f => isCDS(f) && hasMatureProteinChildren(f),
    ).length > 1

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
    const childLabel = resolveSubfeatureLabel(childFeature, ctx)
    // For shared cleavage products (see disambiguateWithCds above): the same
    // mature peptide appears once per polyprotein CDS at identical coordinates,
    // so append the owning CDS's product to keep the rows distinct ("nsp1 (ORF1a
    // polyprotein)" vs "nsp1 (ORF1ab polyprotein)") instead of looking like a
    // duplicate/bug — but only when the CDS resolves a real name/product, not
    // just its bare id.
    const displayLabel =
      disambiguateWithCds &&
      cdsLabel &&
      cdsLabel !== childLabel &&
      cdsLabel !== cdsFeature.id()
        ? `${childLabel} (${cdsLabel})`
        : childLabel

    // mirror the transcript path so `subfeatureLabels` actually labels mature
    // peptides (matureProteinRegion glyph)
    registerSubfeature(
      {
        feature: childFeature,
        parentFeatureId: rootFeature.id(),
        type: featureType(childFeature),
        topPx,
        heightPx: childLayout.height,
        displayLabel,
      },
      ctx,
      collector,
    )
  }
  emitStrandArrow(
    layout.feature,
    baseTopPx,
    layout.height,
    colorToUint32(strokeColor(layout.feature, ctx)),
    flatbushIdx,
    collector.arrows,
  )
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
  baseTopPx: number,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
) {
  const strokeUint = colorToUint32(strokeColor(feature, ctx))
  collector.lines.push({
    start: feature.get('start'),
    end: feature.get('end'),
    y: baseTopPx + layout.height / 2,
    height: layout.height,
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
          baseTopPx + childLayout.y,
          childLayout.height,
          REPEAT_BODY_HEIGHT_FRACTION,
        )
      : [baseTopPx + childLayout.y, childLayout.height]
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

    const displayLabel = resolveSubfeatureLabel(childFeature, ctx)
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

  emitTopLevelStrandArrow(layout, baseTopPx, flatbushIdx, ctx, collector)
}

// CRISPR guide RNA (CrisprGuideAdapter): the whole feature box is the
// protospacer+PAM span in the config color; the PAM subfeature is overpainted
// red and the predicted cut site (the feature's `cutSite` attribute) is a dark
// tick drawn on top. A zero-width cut rect is widened to MIN_RECT_WIDTH_PX by
// the rect shader, so it renders as a thin vertical bar. The PAM is registered
// as a hoverable subfeature.
function processCrisprGuideLayout(
  layout: FeatureLayout,
  baseTopPx: number,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
) {
  const { feature, height } = layout
  const strand = feature.get('strand') ?? 0

  pushBoxRect(feature, baseTopPx, height, flatbushIdx, ctx, collector.rects)

  const pam = getSubfeatures(feature).find(f => featureType(f) === 'PAM')
  if (pam) {
    collector.rects.push({
      start: pam.get('start'),
      end: pam.get('end'),
      y: baseTopPx,
      height,
      color: CRISPR_PAM_COLOR,
      strand,
      flatbushIdx,
      densityFade: false,
    })
    registerSubfeature(
      {
        feature: pam,
        parentFeatureId: feature.id(),
        type: 'PAM',
        topPx: baseTopPx,
        heightPx: height,
        displayLabel: 'PAM',
      },
      ctx,
      collector,
    )
  }

  const cutSite = feature.get('cutSite')
  if (typeof cutSite === 'number') {
    collector.rects.push({
      start: cutSite,
      end: cutSite,
      y: baseTopPx,
      height,
      color: CRISPR_CUT_COLOR,
      strand,
      flatbushIdx,
      densityFade: false,
    })
  }

  emitTopLevelStrandArrow(layout, baseTopPx, flatbushIdx, ctx, collector)
}

// A plain leaf feature. As the top-level glyph it fades on collapse and shows a
// strand arrow; as a stacked child of a gene (a bare feature beside the gene's
// transcripts) it is a plain box registered as an individually hoverable/
// selectable subfeature — mirroring the transcript and mature-protein branches
// rather than leaving hover to fall back to the whole-gene entry.
function emitBox(
  layout: FeatureLayout,
  baseTopPx: number,
  parentFeature: Feature,
  isRoot: boolean,
  flatbushIdx: number,
  ctx: RenderContext,
  collector: Collector,
) {
  const { feature, height } = layout
  pushBoxRect(
    feature,
    baseTopPx,
    height,
    flatbushIdx,
    ctx,
    collector.rects,
    undefined,
    isRoot,
  )
  if (isRoot) {
    emitTopLevelStrandArrow(layout, baseTopPx, flatbushIdx, ctx, collector)
  } else {
    registerSubfeature(
      {
        feature,
        parentFeatureId: parentFeature.id(),
        type: featureType(feature),
        topPx: baseTopPx,
        heightPx: height,
        displayLabel: resolveSubfeatureLabel(feature, ctx),
      },
      ctx,
      collector,
    )
  }
}

// One recursive dispatch over the tagged glyph tree, replacing the former split
// between a top-level Record and a separate hand-written child switch. Each
// glyph emits its own primitives at `baseTopPx`; `Subfeatures` recurses into its
// stacked children, shifting the offset and attributing them to itself as their
// `parentFeature`. `isRoot` marks the top-level feature (only its box fades on
// collapse and skips subfeature registration). Strand-arrow suppression for
// nested features keys off the feature's own parent linkage inside
// emitTopLevelStrandArrow, independent of layout position.
function emitGlyph(
  layout: FeatureLayout,
  args: {
    baseTopPx: number
    flatbushIdx: number
    isRoot: boolean
    parentFeature: Feature
  },
  ctx: RenderContext,
  collector: Collector,
) {
  const { baseTopPx, flatbushIdx, isRoot, parentFeature } = args
  const { feature } = layout
  switch (layout.glyphType) {
    case 'Subfeatures': {
      for (const child of layout.children) {
        emitGlyph(
          child,
          {
            baseTopPx: baseTopPx + child.y,
            flatbushIdx,
            isRoot: false,
            parentFeature: feature,
          },
          ctx,
          collector,
        )
      }
      break
    }
    case 'ProcessedTranscript':
    case 'Segments': {
      processTranscriptLayout(
        layout,
        baseTopPx,
        parentFeature,
        flatbushIdx,
        ctx,
        collector,
      )
      break
    }
    // parentFeature is both the peptide-translation key and the subfeature
    // attribution root (the enclosing gene when nested, else the CDS itself);
    // `feature` is the CDS owning the mature-region children, for the label.
    case 'MatureProteinRegion': {
      processMatureProteinLayout(
        layout,
        parentFeature,
        baseTopPx,
        flatbushIdx,
        ctx,
        collector,
        feature,
      )
      break
    }
    case 'RepeatRegion': {
      processRepeatRegionLayout(
        layout,
        feature,
        baseTopPx,
        flatbushIdx,
        ctx,
        collector,
      )
      break
    }
    case 'CrisprGuide': {
      processCrisprGuideLayout(layout, baseTopPx, flatbushIdx, ctx, collector)
      break
    }
    case 'Box': {
      emitBox(
        layout,
        baseTopPx,
        parentFeature,
        isRoot,
        flatbushIdx,
        ctx,
        collector,
      )
      break
    }
    default: {
      // exhaustiveness: a new GlyphType without a case here is a compile error
      const _exhaustive: never = layout.glyphType
      return _exhaustive
    }
  }
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
    // Box is the only glyph that emits a density-fade rect (see emitBox, isRoot).
    densityFade: layout.glyphType === 'Box',
  })
  const flatbushIdx = collector.flatbushItems.length - 1

  emitGlyph(
    layout,
    { baseTopPx: 0, flatbushIdx, isRoot: true, parentFeature: feature },
    ctx,
    collector,
  )
}
