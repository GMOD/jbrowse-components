import { cssColorToABGR as colorToUint32 } from '@jbrowse/core/util/colorBits'

import {
  createFeatureFloatingLabels,
  createMoreIsoformsLabel,
} from '../floatingLabels.ts'
import { collectPolyproteinCDS } from '../glyphs/matureProteinRegion.ts'
import { transcriptCoords } from '../glyphs/transcriptCoords.ts'
import {
  getFeatureName,
  readFeatureLabels,
  readFeatureName,
} from '../labelUtils.ts'
import { featureType, getSubfeatures } from '../util.ts'
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

import type { FeatureLayout, GlyphType } from '../types.ts'
import type {
  Collector,
  GlyphPlacement,
  RenderContext,
} from './renderContext.ts'
import type { Feature } from '@jbrowse/core/util'

// Subfeature display label: the config-jexl `labels.name` slot (so a `product`
// override surfaces for mature peptides / repeat subparts that carry no `name`),
// falling back to the plain name/id. Shared by the mature-protein, repeat-region
// and stacked-box paths so their labels can't drift.
function resolveSubfeatureLabel(feature: Feature, ctx: RenderContext) {
  return (
    readFeatureName(ctx.config, feature, ctx.jexl) ?? getFeatureName(feature)
  )
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
  const strokeUint = colorToUint32(strokeColor(transcriptFeature, ctx))

  emitIntronLines(
    {
      transcript,
      topPx: transcriptTopPx,
      labelRowsAbove,
      strokeUint,
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
    const transcriptStart = transcriptFeature.get('start')
    const transcriptEnd = transcriptFeature.get('end')
    const transcriptType = transcriptFeature.get('type')
    // Config-jexl name (falling back to plain name/id) so a custom `labels.name`
    // drives transcript labels too, matching the mature-protein/repeat subparts.
    const transcriptName = resolveSubfeatureLabel(transcriptFeature, ctx)

    collector.subfeatureInfos.push({
      kind: 'subfeature',
      featureId: transcriptFeature.id(),
      parentFeatureId: parentFeature.id(),
      type: transcriptType,
      startBp: transcriptStart,
      endBp: transcriptEnd,
      topPx: transcriptTopPx,
      bottomPx: transcriptTopPx + transcript.totalLayoutHeight,
      labelRowsAbove,
      // when this transcript reserved a label row, the row falls below its body
      // and the hit box covers it
      ownsLabelRow: transcript.ownsLabelRow,
      displayLabel: transcriptName,
      transcript: transcriptCoords(transcript),
    })

    emitSubfeatureLabel(
      {
        featureId: transcriptFeature.id(),
        displayLabel: transcriptName,
        featureHeight: transcript.height,
        minX: transcriptStart,
        maxX: transcriptEnd,
        topY: transcriptTopPx,
        labelRowsAbove,
        parentFeatureId: parentFeature.id(),
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
      strokeUint,
      flatbushIdx,
      labelRowsAbove,
    },
    collector,
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
    labelRowsAbove: number
    ownsLabelRow?: boolean
    displayLabel: string | undefined
  },
  ctx: RenderContext,
  collector: Collector,
) {
  const { feature, parentFeatureId, type, topPx, heightPx, displayLabel } = args
  const { labelRowsAbove, ownsLabelRow } = args
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
          baseColor: MATURE_PROTEIN_COLOR_HEX[colorIdx]!,
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
      strokeUint: colorToUint32(strokeColor(layout.feature, ctx)),
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
  const strokeUint = colorToUint32(strokeColor(feature, ctx))
  collector.lines.push({
    start: feature.get('start'),
    end: feature.get('end'),
    y: baseTopPx + layout.height / 2,
    height: layout.height,
    color: strokeUint,
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

  const pam = getSubfeatures(feature).find(
    f => featureType(f).toLowerCase() === 'pam',
  )
  if (pam) {
    collector.rects.push({
      start: pam.get('start'),
      end: pam.get('end'),
      y: baseTopPx,
      height,
      color: CRISPR_PAM_COLOR,
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
        displayLabel: 'PAM',
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
        type: featureType(feature),
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
  for (const child of layout.children) {
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
  // A gene that dropped isoforms — collapsed to one by `longestCoding`, or
  // truncated to the rows the track has by the height cap — still carries its
  // own start/end spanning every hidden one. Anchor the label + hit box to what
  // actually drew, so the name doesn't float left of the visible glyph over
  // empty track.
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
    palette: ctx.palette,
  })

  // Only beside a name, because the badge sits ON the name row and is read as
  // part of it — a gene the annotation never named has no label for it to
  // qualify, and floating one alone under the glyph would read as a transcript
  // label rather than as this gene's own missing count.
  const moreIsoformsLabel =
    nameLabel && layout.isoformOverflow
      ? createMoreIsoformsLabel({
          overflow: layout.isoformOverflow,
          palette: ctx.palette,
        })
      : undefined

  if (nameLabel || descriptionLabel) {
    collector.floatingLabelsData[feature.id()] = {
      featureId: feature.id(),
      minX: featureStart,
      maxX: featureEnd,
      topY: 0,
      featureHeight: layout.height,
      labelRows: layout.labelRows,
      nameLabel,
      descriptionLabel,
      moreIsoformsLabel,
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
    // A standalone transcript (no gene wrapper) registers no SubfeatureInfo, so
    // its exon bounds ride here instead — same lookup either way for the hover.
    transcript: transcriptCoords(layout),
    // Fade *eligibility*, per feature: Box is the only glyph whose top-level box
    // layout may collapse onto row 0 and fade (see isSubPixelFade). The actual
    // per-rect decision is layout's alone. The worker writes no rect-level flag.
    densityFade: layout.glyphType === 'Box',
    labelRows: layout.labelRows,
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
