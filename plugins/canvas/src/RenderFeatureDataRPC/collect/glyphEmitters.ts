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

// Shared by the mature-protein, repeat-region and stacked-box paths, and by
// the row reservation in the layout pass — see `subfeatureLabelText`.
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
  // exon path: CDS children align 1:1 with the translation segments, so each
  // child's residues are an exact `start-end` key lookup
  const aminoAcidsBySeg = aminoAcidsByFeature(transcriptFeature, ctx)
  // Segments already drawn as codons. The residues are deduped and the CHILDREN
  // are not: dedupedSortedCDS collapses a repeated CDS row — Gencode v36 emits
  // them, which is the whole reason it exists — so the protein isn't
  // frameshifted, but both copies survive into the layout and both resolve the
  // same map entry. Every residue of that segment was then emitted twice: two
  // stacked rects, two overlay items for the hover and the codon hit test to
  // walk, and two identical <text> runs in an SVG export. A repeat is skipped
  // outright rather than falling through to the box below, which would paint a
  // flat rect over the codons it duplicates.
  const drawnSegments = new Set<string>()

  for (const childLayout of transcript.children) {
    const childFeature = childLayout.feature
    const childStart = childFeature.get('start')
    const childEnd = childFeature.get('end')

    // amino-acid segments key off CDS bounds, so any child matching one is
    // coding — UTR sizing never applies on this branch
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

  // Transcript metadata: subfeature hit info + floating label. Skipped when the
  // transcript is itself the top-level feature (a standalone mRNA with no gene
  // wrapper) — it already has its own flatbush entry and name label from
  // processFeatureRecord, so self-registering would double-draw the label and
  // shadow the feature's own mouseover tooltip. Mirrors emitBox's isRoot guard.
  if (!isRoot) {
    registerSubfeature(
      {
        feature: transcriptFeature,
        parentFeatureId: parentFeature.id(),
        type: transcriptFeature.get('type'),
        topPx: transcriptTopPx,
        heightPx: transcript.height,
        labelRowsAbove,
        // when this transcript reserved a label row, the row falls below its
        // body and the hit box covers it
        ownsLabelRow: transcript.ownsLabelRow,
        // config-jexl name (falling back to plain name/id) so a custom
        // `labels.name` drives transcript labels too
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

// Register a subfeature as both a hoverable/selectable hit-test entry and (when
// subfeatureLabels is enabled) a floating label, keyed by the child's own
// coordinates.
//
// THE registration path — every glyph that registers a child goes through it, so
// the recorded metadata cannot drift between them. It used to be shared by the
// mature-protein and repeat-region paths only, while the transcript and box
// paths each wrote the same two calls out by hand; `emitBox`'s copy is the one
// that dropped `ownsLabelRow` and left a leaf child's hit box a label row short
// of the row the packer had reserved. A field added here now reaches every
// caller instead of three out of four.
//
// `transcript` is what the transcript path adds and the others have no answer
// for: the exon/CDS geometry the hover needs to name a c./n. position.
function registerSubfeature(
  args: {
    feature: Feature
    parentFeatureId: string
    // `string | undefined` like the `HitItemBase` field it fills, not the
    // `featureType()` spelling the other callers use — a glyph that resolved by
    // type always has one, but the context menu's noun fallback keys on
    // undefined, and `''` would defeat it.
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

// Viral polyproteins: a CDS whose mature_protein_region children tile the ORF,
// stacked in rows by layoutMatureProteinRegion. Each child already carries its
// own y/height; draw a strand arrow on the polyprotein CDS so it shows direction
// like the transcript path does. Drawn unconditionally (not parent-gated like
// leaf glyphs) because the enclosing gene renders as a Subfeatures container
// that draws no arrow of its own — so a nested CDS (gene → ORF1ab CDS → nsp*,
// and the enterovirus gene → CDS → mature peptides) would otherwise lose its
// direction entirely, unlike a gene → mRNA whose transcript always shows one.
// `place.baseTopPx` shifts the rows when the CDS is nested inside a container
// glyph. `place.parentFeature` is the attribution root (the enclosing gene when
// nested, the CDS itself otherwise — the one GetCanvasFeatureDetails resolves by
// id, and the peptide-translation key); each region is registered as a
// subfeature off it so it is individually hoverable and selectable.
// `layout.feature` is the polyprotein CDS that directly owns the mature-region
// children — the same object for a standalone CDS, but the immediate child
// layout's feature (not the enclosing gene) when nested, used only to resolve
// the right per-CDS product name for the label.
//
// When zoomed in far enough that peptide data is present, each region shows the
// amino-acid letters of its slice of the polyprotein. The protein is translated
// once from the whole ORF (keyed by rootFeature.id() in peptideDataMap), then
// each residue is assigned to the region containing its genomic start — so
// nested/overlapping cleavage products (e.g. VP0 over VP4+VP2) each get the
// residues they cover without double-translating or drifting out of frame.
function processMatureProteinLayout(
  layout: FeatureLayout,
  place: GlyphPlacement,
  ctx: RenderContext,
  collector: Collector,
) {
  const { baseTopPx, flatbushIdx } = place
  const { parentFeature: rootFeature } = place
  const cdsFeature = layout.feature
  // one flat residue list for the whole ORF; the polyprotein CDS is a single
  // reading frame, so mature regions are sub-slices of it rather than the
  // segment-aligned children the exon path keys on. Keyed on the CDS, not the
  // enclosing gene — a gene can own two overlapping polyproteins (SARS-CoV-2
  // pp1a/pp1ab) whose residues must not be stitched into one ORF; matches what
  // findTranscriptsWithCDS translates.
  const byCdsSegment = aminoAcidsByFeature(cdsFeature, ctx)
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
  const disambiguateWithCds = collectPolyproteinCDS(rootFeature).length > 1

  for (const [i, childLayout] of layout.children.entries()) {
    const childFeature = childLayout.feature
    const topPx = baseTopPx + childLayout.y
    // this glyph's own rows are per CHILD (one label row under each cleavage
    // product), so they compose with whatever the enclosing gene already spent
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

// Intact transposon (repeat_region): subparts on a single row, joined by one
// connecting line, with no box for the parent itself — like a transcript whose
// exons happen to overlap. The internal *_retrotransposon body is drawn first
// (underneath) and shortened so the full-height LTRs and TSDs that overlap it
// stay visible on top. Each subpart keeps its own type color and is registered
// as an individually hoverable subfeature. See GMOD/jbrowse-components#3080.
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

  // retrotransposon body underneath; LTRs/TSDs painted over it
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

// Draws the cut positions a feature carries as dark ticks over its box, shared
// by the two cut-marking glyphs (CRISPR guide, restriction motif). When both
// strands' cuts are pinned they are half-height — top cut on the upper half,
// bottom cut on the lower half — so the stagger between them reads as the
// overhang the enzyme leaves. A single known cut gets one full-height tick
// instead: half-height there would imply a second cut nothing specified. Zero-
// width cut rects are widened to MIN_RECT_WIDTH_PX by the rect shader.
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
    // Keyed on whichever cut exists, not on `cutSite` specifically, so a feature
    // carrying only `cutSiteBottom` still draws. Testing `topCut` alone silently
    // drew no tick at all for that feature.
    const soleCut = topCut ?? bottomCut
    if (soleCut !== undefined) {
      pushCut(soleCut, baseTopPx, height)
    }
  }
}

// CRISPR guide RNA (CrisprGuideAdapter): the whole feature box is the
// protospacer+PAM span in the config color; the PAM subfeature is overpainted
// red and the predicted cut sites are drawn on top — one tick for a blunt
// cutter like SpCas9, a staggered pair for one like Cas12a. The PAM is
// registered as a hoverable subfeature.
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
        // a literal, so the row it draws into is reserved off the same PAM
        // lookup rather than off a name this subfeature never carries
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

// Sequence motif (MotifListAdapter): the feature box is the recognition site in
// the config color, with its cut positions ticked over it. A palindromic site
// pins both strands' cuts, a type IIS one pins both outright, and a '^' on a
// stranded site pins only the top — see pushCutTicks for how each is drawn.
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

// A plain leaf feature. As the top-level glyph it shows a strand arrow and is the
// one glyph layout may collapse+fade when sub-pixel (via the flatbush item's
// densityFade below); as a stacked child of a gene (a bare feature beside the
// gene's transcripts) it is a plain box registered as an individually hoverable/
// selectable subfeature — mirroring the transcript and mature-protein branches
// rather than leaving hover to fall back to the whole-gene entry.
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
        // the raw slot, not featureType(): Box is the glyph a typeless child
        // lands on, and '' would slip past the context menu's noun fallback
        type: feature.get('type'),
        topPx: baseTopPx,
        heightPx: height,
        labelRowsAbove,
        // `Box` is a self-labeling glyph, so a leaf child of a gene spends its
        // own `below` row and the parent's `labelRows` already counts it. Left
        // off, the row was reserved and the child's hit box stopped one label
        // row short of it — the label under a bare-box child resolved to the
        // gene, and its hover shading was shorter than a sibling transcript's.
        ownsLabelRow: layout.ownsLabelRow,
        displayLabel: resolveSubfeatureLabel(feature, ctx),
      },
      ctx,
      collector,
    )
  }
}

// The container glyph: no primitives of its own, just its stacked children, each
// shifted by its own offset and attributed to the record's ROOT feature.
//
// `place.parentFeature`, not `layout.feature` — they are the same object for a
// top-level container (processFeatureRecord seeds the placement with the record's
// own feature), and forwarding it is what keeps them the same for a container
// nested inside another. `layout.feature` handed a grandchild the intermediate
// container instead, which every consumer of the resulting `parentFeatureId`
// reads as the top-level id: `resolveSubfeature` gates hits on it (so the
// grandchild was drawn, labelled, and unhoverable), `GetCanvasFeatureDetails`
// resolves only top-level ids by it, and the highlight sweep pins by it.
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

// Where each of the collector's append-only lists stood before one stack child
// was emitted.
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

// Attribute everything one direct child of the root pushed to that child's
// ordinal, so the main-thread trim can drop an isoform's primitives out of the
// packed arrays (see `IsoformStack`).
//
// Stamped over the emitted RANGE rather than threaded through every emitter,
// which is what makes it hold at depth for free: a polyprotein's cleavage
// products and a nested container's grandchildren land inside their root
// child's range whatever `parentFeatureId` they register under — and that
// linkage, which aliases every depth to the root, is precisely what cannot
// answer "the direct children of gene X" (ADR-075 §"What is actually missing").
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

// Every glyph emits under the same signature, so the dispatch below is a lookup
// rather than a switch that re-orders the same four values per case — which is
// what it was, in three different orders, two of them with `baseTopPx` and
// `flatbushIdx` adjacent (see GlyphPlacement).
type GlyphEmitter = (
  layout: FeatureLayout,
  place: GlyphPlacement,
  ctx: RenderContext,
  collector: Collector,
) => void

// Keyed by `GlyphType`, so a new glyph type is a compile error here until it
// names an emitter — the same guarantee the old `default: never` case gave, minus
// the case bodies. Segments and ProcessedTranscript share the transcript
// emitter; they differ only in how their layout was built.
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

// One recursive dispatch over the tagged glyph tree. Each glyph emits its own
// primitives at `place.baseTopPx`; `Subfeatures` recurses. `place.isRoot` marks
// the top-level feature (only its box fades on collapse and skips subfeature
// registration). Strand-arrow suppression for nested features keys off the
// feature's own parent linkage inside emitTopLevelStrandArrow, independent of
// layout position.
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
  // A gene `longestCoding` collapsed to one transcript still carries its own
  // start/end spanning every hidden one. Anchor the label + hit box to what
  // actually drew, so the name doesn't float left of the visible glyph over
  // empty track. The fit ladder's trim re-anchors the same way, on the side
  // that dropped them (`applyIsoformTrim`).
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
    // A standalone transcript (no gene wrapper) registers no SubfeatureInfo, so
    // its exon bounds ride here instead — same lookup either way for the hover.
    transcript: transcriptCoords(layout),
    // Fade *eligibility*, per feature: Box is the only glyph whose top-level box
    // layout may collapse onto row 0 and fade (see isSubPixelFade). The actual
    // per-rect decision is layout's alone. The worker writes no rect-level flag.
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
