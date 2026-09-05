import { reservesBelowLabelRow } from '../labelUtils.ts'
import { featureType, getSubfeatures, isCDS } from '../util.ts'
import { findGlyph } from './findGlyph.ts'
import {
  TRANSCRIPT_PADDING_RATIO,
  featureHeightPx,
  isCodingFeature,
} from './glyphUtils.ts'

import type { DisplayConfig } from '../renderConfig.ts'
import type { IsoformStack } from '../rpcTypes.ts'
import type { FeatureLayout, LayoutArgs } from '../types.ts'
import type { Feature } from '@jbrowse/core/util'

// Is this child one of the isoforms the gene chooses among, rather than a
// decoration beside them (an NCBI source record, a `biological_region`)?
// Structural first, like findGlyph's dispatch, because `transcriptTypes` names
// none of `lnc_RNA`, `misc_RNA`, `ncRNA` or `pseudogenic_transcript` — the type
// test only catches a childless transcript.
function isIsoform(sub: Feature, transcriptTypes: ReadonlySet<string>) {
  return (
    getSubfeatures(sub).length > 0 ||
    transcriptTypes.has(featureType(sub).toLowerCase())
  )
}

function transcriptTypeSet(config: DisplayConfig) {
  return new Set(config.transcriptTypes.map(t => t.toLowerCase()))
}

function getIsoforms(
  subfeatures: Feature[],
  transcriptTypes: ReadonlySet<string>,
) {
  const isoforms = subfeatures.filter(sub => isIsoform(sub, transcriptTypes))
  return isoforms.length > 0 ? isoforms : subfeatures
}

// "Longest coding" is the longest protein — summed CDS length, not the widest
// genomic footprint an isoform with a large intron could win. Segments dedupe by
// start-end, because a duplicated CDS row is a real GFF3 quirk that would
// otherwise inflate one isoform past a genuinely longer protein.
function codingLength(feature: Feature): number {
  const seen = new Set<string>()
  let sum = 0
  const walk = (f: Feature) => {
    for (const sub of getSubfeatures(f)) {
      if (isCDS(sub)) {
        const start = sub.get('start')
        const end = sub.get('end')
        const key = `${start}-${end}`
        if (!seen.has(key)) {
          seen.add(key)
          sum += end - start
        }
      } else {
        walk(sub)
      }
    }
  }
  walk(feature)
  return sum === 0 && isCDS(feature)
    ? feature.get('end') - feature.get('start')
    : sum
}

// A position in `canonicalTranscriptTags` rather than a boolean, because the
// default list holds two tags one gene can carry at once and flattening them to
// "tagged" leaves the coding-length tiebreak to pick between them. A GFF3
// attribute holding a comma list arrives as an array, hence both shapes.
function canonicalRank(feature: Feature, field: string, wanted: string[]) {
  const value = feature.get(field)
  const values = Array.isArray(value)
    ? value.map(v => String(v).toLowerCase())
    : typeof value === 'string'
      ? [value.toLowerCase()]
      : []
  let best = Infinity
  for (const v of values) {
    const rank = wanted.indexOf(v)
    if (rank !== -1 && rank < best) {
      best = rank
    }
  }
  return best
}

interface IsoformScore {
  canonical: number
  coding: boolean
}

// Protein length is deliberately absent: only the ranking needs it, and every
// gene on screen would pay `codingLength`'s subtree walk on every layout while
// the ranking runs only when a gene actually collapses.
function scoreIsoforms(features: Feature[], config: DisplayConfig) {
  const { canonicalTranscriptField: field, canonicalTranscriptTags } = config
  const wanted = canonicalTranscriptTags.map(t => t.toLowerCase())
  return new Map<string, IsoformScore>(
    features.map(feature => [
      feature.id(),
      {
        canonical: wanted.length
          ? canonicalRank(feature, field, wanted)
          : Infinity,
        coding: isCodingFeature(feature),
      },
    ]),
  )
}

type Scores = ReturnType<typeof scoreIsoforms>

// Best first. A curated tag outranks every measurement, because for a gene whose
// longest protein is a minor variant it is the only thing that picks the right
// isoform. A coding-length tie resolves to the LATER isoform, which a stable
// sort would break the other way — hence the explicit index term.
function rankIsoforms(isoforms: Feature[], scores: Scores): Feature[] {
  return isoforms
    .map((feature, index) => {
      const { canonical, coding } = scores.get(feature.id())!
      return {
        feature,
        index,
        canonical,
        coding,
        size: coding
          ? codingLength(feature)
          : feature.get('end') - feature.get('start'),
      }
    })
    .sort(
      (a, b) =>
        a.canonical - b.canonical ||
        Number(b.coding) - Number(a.coding) ||
        b.size - a.size ||
        b.index - a.index,
    )
    .map(s => s.feature)
}

function totalLabelRows(layout: FeatureLayout) {
  return (layout.labelRows ?? 0) + (layout.ownsLabelRow ? 1 : 0)
}

// The survivor rides in a Set so the caller's filter keeps the caller's order,
// and a gene under the cap lays out identically with the collapse on and off.
function keepBest(ranked: Feature[], scores: Scores, config: DisplayConfig) {
  const best = ranked[0]!
  return {
    keep: new Set([best.id()]),
    canonicalTag:
      config.canonicalTranscriptTags[scores.get(best.id())!.canonical],
  }
}

// `longestCoding` is the only collapse the worker still makes: it is the user's
// own pick and the payload gate at whole-chromosome zoom. Everything else the
// display gives up, it gives up on the main thread where it can see the pack.
function collapseIsoforms({
  isoforms,
  scores,
  config,
}: {
  isoforms: Feature[]
  scores: Scores
  config: DisplayConfig
}) {
  return config.geneGlyphMode === 'longestCoding' && isoforms.length > 1
    ? keepBest(rankIsoforms(isoforms, scores), scores, config)
    : undefined
}

// Not `glyphUtils`' exported `layoutChild`, which is the opposite thing: a flat
// `Box` with no children, for the glyphs whose children are leaves.
function layoutStackedChild(child: Feature, args: LayoutArgs) {
  const { feature, config } = args
  const layout = findGlyph(
    child,
    config,
    false,
  )({
    ...args,
    feature: child,
    parentFeature: feature,
  })
  layout.ownsLabelRow = reservesBelowLabelRow({
    feature: child,
    config,
    glyphType: layout.glyphType,
    jexl: args.jexl,
  })
  return layout
}

// `rank` is deliberately not the drawn position: the stack sorts by (canonical,
// coding) alone while the ranking also weighs protein length, so "drop a suffix"
// would keep a different set than `longestCoding` does at k = 1.
function buildIsoformStack({
  drawn,
  children,
  isoformSet,
  isoformCount,
  scores,
  boxHeightPx,
  canonicalTag,
  collapsedIsoformCount,
}: {
  drawn: Feature[]
  children: FeatureLayout[]
  isoformSet: ReadonlySet<Feature>
  isoformCount: number
  scores: Scores
  boxHeightPx: number
  canonicalTag: string | undefined
  collapsedIsoformCount: number | undefined
}): IsoformStack {
  const rankById = new Map(
    rankIsoforms(
      drawn.filter(f => isoformSet.has(f)),
      scores,
    ).map((f, i) => [f.id(), i]),
  )
  return {
    isoformCount,
    canonicalTag,
    collapsedIsoformCount,
    boxHeightPx,
    children: drawn.map((child, ordinal) => {
      const layout = children[ordinal]!
      const isoform = isoformSet.has(child)
      return {
        featureId: child.id(),
        ordinal,
        isoform,
        rank: isoform ? rankById.get(child.id())! : Infinity,
        yPx: layout.y,
        heightPx: layout.height,
        labelRows: totalLabelRows(layout),
        startBp: child.get('start'),
        endBp: child.get('end'),
      }
    }),
  }
}

export function layoutSubfeatures(args: LayoutArgs): FeatureLayout {
  const { feature, config } = args
  const { geneGlyphMode } = config

  // Spent only on the inter-transcript gap below — each stacked child carries
  // whatever height its own glyph resolved.
  const heightPx = featureHeightPx(feature, args)

  let subfeatures = [...getSubfeatures(feature)]

  const scores = scoreIsoforms(subfeatures, config)

  // One list drives both the gene-glyph control's visibility and the
  // longestCoding collapse, so the control appears exactly when switching modes
  // would change something.
  const isoforms = getIsoforms(subfeatures, transcriptTypeSet(config))
  const hasMultipleIsoforms = isoforms.length > 1
  const isoformSet = new Set(isoforms)

  // Ranked BEFORE the stack sort below, which sorts in place over an array
  // `isoforms` can BE, and rankIsoforms breaks a tie by index. An expanded gene
  // draws every isoform whatever the mode says.
  const expanded = args.expandedGeneIds?.has(feature.id()) ?? false
  const collapsed = expanded
    ? undefined
    : collapseIsoforms({ isoforms, scores, config })

  // Drops the isoforms that lost and leaves the decorations beside them alone.
  if (collapsed) {
    subfeatures = subfeatures.filter(
      f => !isoformSet.has(f) || collapsed.keep.has(f.id()),
    )
  }

  if (!collapsed) {
    // Leads with the two terms `rankIsoforms` does, and stays stable below them.
    // Gated on the collapse rather than the mode, because `longestCoding`
    // declines to collapse a gene the user EXPANDED and that gene draws every
    // isoform.
    subfeatures.sort((a, b) => {
      const x = scores.get(a.id())!
      const y = scores.get(b.id())!
      return x.canonical - y.canonical || Number(y.coding) - Number(x.coding)
    })
  }

  const children: FeatureLayout[] = []
  let currentYPx = 0
  // Counted, never added to `currentYPx`: a label row's height is the display
  // mode's label font size and only the main thread knows it, so every Y this
  // loop writes stays proportional to `heightPx` and the main thread's uniform
  // compact scale stays exact.
  let labelRows = 0

  for (const [i, child] of subfeatures.entries()) {
    const childLayout = layoutStackedChild(child, args)

    childLayout.y = currentYPx
    childLayout.labelRowsAbove = labelRows

    children.push(childLayout)

    currentYPx += childLayout.height
    labelRows += totalLabelRows(childLayout)
    if (i < subfeatures.length - 1) {
      currentYPx += heightPx * TRANSCRIPT_PADDING_RATIO
    }
  }

  const totalHeightPx = currentYPx > 0 ? currentYPx : heightPx

  return {
    feature,
    glyphType: 'Subfeatures',
    y: 0,
    height: totalHeightPx,
    children,
    labelRows,
    isoformsCollapsed: collapsed !== undefined,
    canonicalTag: collapsed?.canonicalTag,
    hasMultipleIsoforms,
    isoformStack:
      hasMultipleIsoforms || subfeatures.length > 1
        ? buildIsoformStack({
            drawn: subfeatures,
            children,
            isoformSet,
            isoformCount: isoforms.length,
            scores,
            boxHeightPx: heightPx,
            canonicalTag: collapsed?.canonicalTag,
            collapsedIsoformCount:
              geneGlyphMode === 'longestCoding' && hasMultipleIsoforms
                ? 1
                : undefined,
          })
        : undefined,
  }
}
