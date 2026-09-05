import {
  anyIsoformsHidden,
  dominantIsoformTag,
  isoformPickEntries,
} from '../../RenderFeatureDataRPC/isoformPicks.ts'

import type { IsoformPicks } from '../../RenderFeatureDataRPC/isoformPicks.ts'
import type { GeneGlyphMode } from '../geneGlyphMode.ts'

export function geneGlyphChipLabel(
  maxIsoforms: number | undefined,
  picks?: IsoformPicks,
) {
  if (maxIsoforms !== undefined && maxIsoforms > 1) {
    return 'Isoforms trimmed'
  }
  const tag = dominantIsoformTag(picks)
  if (tag) {
    return tag
  }
  // The mode changes the chip at once but the worker reports its picks a fetch
  // later, so `anyIsoformsHidden` separates "nothing has answered yet" from
  // "these genes carry no tag".
  return anyIsoformsHidden(picks) ? 'Longest isoform' : 'One isoform'
}

function pickPhrase(picks: IsoformPicks | undefined) {
  const entries = isoformPickEntries(picks)
  return entries.length === 1
    ? entries[0]![0]
    : entries.length > 1
      ? entries.map(([rule, n]) => `${n} ${rule}`).join(', ')
      : undefined
}

export function geneGlyphTooltip({
  mode,
  collapsed,
  maxIsoforms,
  picks,
}: {
  mode: GeneGlyphMode
  collapsed: boolean
  maxIsoforms?: number
  picks?: IsoformPicks
}) {
  if (!collapsed) {
    return 'All transcripts per gene.'
  }
  if (maxIsoforms !== undefined) {
    const tag = dominantIsoformTag(picks)
    return `Up to ${maxIsoforms} transcript${maxIsoforms === 1 ? '' : 's'} per gene fit this height${tag ? ` (${tag} first)` : ''}. A taller track or All transcripts shows more.`
  }
  const picked = pickPhrase(picks)
  const zoom = mode === 'auto' ? ', chosen by zoom. Zoom in for all' : ''
  return `One transcript per gene${picked ? ` (${picked})` : ''}${zoom}.`
}
