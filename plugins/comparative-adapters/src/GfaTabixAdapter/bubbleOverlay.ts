import {
  checkStopToken2,
  createStopTokenChecker,
} from '@jbrowse/core/util/stopToken'

import { flipCs } from '../csUtils.ts'

import type { MultiPairFeature } from '../MultiPairFeature.ts'
import type { TabixIndexedFile } from '@gmod/tabix'
import type { StopToken } from '@jbrowse/core/util/stopToken'
import type { Region } from '@jbrowse/core/util/types'

// One bubble site (locus) — the natural runtime unit. The bubbles index on
// disk (`bubbles.bed.gz`) stores one BED row per (locus, alleleA, alleleB)
// pair; we group rows by (start, end) on parse so the runtime walker treats
// sites as atomic. Sites originate upstream from `vg deconstruct` output,
// but the runtime does not read VCF — only the BED-formatted bubbles index.
export interface BubbleSite {
  start: number
  end: number
  // genomeIdx → which allele the genome carries at this site
  alleleByGenome: Map<number, number>
  // ${alleleLo}-${alleleHi} → CS describing alleleLo→alleleHi edits
  pairs: Map<string, { cs: string; identity: number }>
}

export function findBubblePair(
  site: BubbleSite,
  queryGenomeIdx: number,
  refGenomeIdx: number | undefined,
) {
  const queryAllele = site.alleleByGenome.get(queryGenomeIdx)
  const refAllele =
    refGenomeIdx === undefined
      ? 0
      : (site.alleleByGenome.get(refGenomeIdx) ?? 0)
  if (queryAllele === undefined || queryAllele === refAllele) {
    return undefined
  }
  const lo = Math.min(refAllele, queryAllele)
  const hi = Math.max(refAllele, queryAllele)
  const pair = site.pairs.get(`${lo}-${hi}`)
  if (!pair) {
    return undefined
  }
  return {
    cs: refAllele > queryAllele ? flipCs(pair.cs) : pair.cs,
    identity: pair.identity,
  }
}

// Build a single CS string for a synteny feature by walking its CIGAR
// and the bubble sites covering the region in lockstep. CIGAR `=`/`X`/`M`
// runs are sub-walked:
// sites overlapping the run contribute their pair CS (SNPs/microindels),
// gaps fill with `:N`. CIGAR `D`/`N`/`I` become synthetic length-only
// `-`/`+` ops with `n` placeholder bases (the renderer reads only length,
// not bases).
//
// CS strictly supersedes CIGAR: once written, the renderer can ignore CIGAR
// for this feature without losing structural detail.
export function buildCsFromCigarAndSites(
  feat: { start: number; end: number; cigar?: string },
  sites: BubbleSite[],
  startSi: number,
  queryGenomeIdx: number,
  refGenomeIdx: number | undefined,
) {
  const csParts: string[] = []
  let identityMatchBp = 0
  let identityTotalBp = 0
  let pos = feat.start
  let si = startSi

  function consumeSitesWithin(runEnd: number) {
    while (si < sites.length) {
      const site = sites[si]!
      if (site.start >= runEnd) {
        break
      }
      if (site.end <= pos) {
        si++
        continue
      }
      // Site straddling a run boundary cannot apply cleanly — its CS describes
      // ref bp that fall outside the alt-aligned range. Skip; the surrounding
      // `:gap` fills its span.
      if (site.start < pos || site.end > runEnd) {
        si++
        continue
      }

      if (site.start > pos) {
        const gap = site.start - pos
        csParts.push(`:${gap}`)
        identityMatchBp += gap
        identityTotalBp += gap
        pos = site.start
      }

      const len = site.end - site.start
      const pair = findBubblePair(site, queryGenomeIdx, refGenomeIdx)
      if (pair && pair.cs.length > 0) {
        csParts.push(pair.cs)
        identityMatchBp += pair.identity * len
      } else {
        csParts.push(`:${len}`)
        identityMatchBp += len
      }
      identityTotalBp += len
      pos = site.end
      si++
    }

    if (pos < runEnd) {
      const trailing = runEnd - pos
      csParts.push(`:${trailing}`)
      identityMatchBp += trailing
      identityTotalBp += trailing
      pos = runEnd
    }
  }

  if (!feat.cigar) {
    consumeSitesWithin(feat.end)
  } else {
    let cigarLen = 0
    for (let i = 0; i < feat.cigar.length; i++) {
      const ch = feat.cigar.charCodeAt(i)
      if (ch >= 48 && ch <= 57) {
        cigarLen = cigarLen * 10 + (ch - 48)
        continue
      }
      const op = feat.cigar[i]!
      if (op === '=' || op === 'M' || op === 'X') {
        // X (mismatch run) is processed like = so bubble CS supplies per-base
        // detail. X marks equal-length segment swaps (alt-allele SNVs).
        // Falling back to `:N` inside
        // consumeSitesWithin loses mismatch info but keeps identity numerics
        // correct.
        consumeSitesWithin(pos + cigarLen)
      } else if (op === 'D' || op === 'N') {
        csParts.push(`-${'n'.repeat(cigarLen)}`)
        identityTotalBp += cigarLen
        pos += cigarLen
      } else if (op === 'I') {
        csParts.push(`+${'n'.repeat(cigarLen)}`)
      }
      cigarLen = 0
    }
  }

  return {
    cs: csParts.join(''),
    identityMatchBp,
    identityTotalBp,
  }
}

function parseGenomeIdxList(field: string | undefined, alleleIdx: number) {
  if (!field) {
    return undefined
  }
  const out: [number, number][] = []
  for (const tok of field.split(',')) {
    if (tok.length > 0) {
      out.push([+tok, alleleIdx])
    }
  }
  return out
}

// Parse one row of the bubbles index into the (siteKey, pair,
// [genomeIdx, alleleIdx][]) tuple the site grouper consumes. The on-disk
// schema is per-pair; we normalize to per-site immediately so the rest of
// the pipeline only sees BubbleSite.
function parseBubbleLine(line: string) {
  const cols = line.split('\t')
  const start = +cols[1]!
  const end = +cols[2]!
  const alleleA = +cols[3]!
  const alleleB = +cols[4]!
  const lo = Math.min(alleleA, alleleB)
  const hi = Math.max(alleleA, alleleB)
  return {
    start,
    end,
    pairKey: `${lo}-${hi}`,
    pair: {
      cs: cols[6] ?? '',
      identity: +cols[5]!,
    },
    alleleAssignments: [
      ...(parseGenomeIdxList(cols[7], alleleA) ?? []),
      ...(parseGenomeIdxList(cols[8], alleleB) ?? []),
    ],
  }
}

async function fetchBubbleSites(
  bubblesFile: TabixIndexedFile,
  tabixRefName: string,
  region: Region,
  stopToken: StopToken | undefined,
) {
  const sites = new Map<string, BubbleSite>()
  const checker = createStopTokenChecker(stopToken)
  await bubblesFile.getLines(tabixRefName, region.start, region.end, {
    lineCallback: (line: string) => {
      checkStopToken2(checker)
      const row = parseBubbleLine(line)
      const key = `${row.start}-${row.end}`
      let site = sites.get(key)
      if (!site) {
        site = {
          start: row.start,
          end: row.end,
          alleleByGenome: new Map(),
          pairs: new Map(),
        }
        sites.set(key, site)
      }
      site.pairs.set(row.pairKey, row.pair)
      for (const [gIdx, allele] of row.alleleAssignments) {
        // First-write-wins. Multiple rows agree on (genome, allele) by
        // construction (the preprocessor partitions samples per allele), so
        // overwriting is harmless but not useful.
        if (!site.alleleByGenome.has(gIdx)) {
          site.alleleByGenome.set(gIdx, allele)
        }
      }
    },
  })

  const arr = [...sites.values()]
  arr.sort((a, b) => a.start - b.start || a.end - b.end)
  return arr
}

// Binary search for the first site whose end > pos — i.e. the first site
// that could overlap an interval starting at pos.
function lowerBoundEndGt(sites: BubbleSite[], pos: number) {
  let lo = 0
  let hi = sites.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (sites[mid]!.end <= pos) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

// Walk each feature's CIGAR and the per-region bubble sites in lockstep,
// writing per-feature CS + identity. Mutates `feat.cs` and `feat.identity`
// in place. Called only when bpPerPx is small enough that per-base detail
// is renderable; the cheap pre-check (bubbles index configured + zoom
// small enough) lives in the caller.
//
// `reverseAssemblyNameMap` is display→file rename; bubble headers are
// written by the preprocessor in file-side names so genome lookups
// reverse-map first, then fall back to the display name (no-rename case).
export async function annotateFeaturesWithBubbleCs(args: {
  genomeRows: Map<string, MultiPairFeature[]>
  query: Region
  bubblesFile: TabixIndexedFile
  bubblesGenomeNames: string[]
  tabixRefName: string
  reverseAssemblyNameMap: Map<string, string>
  stopToken?: StopToken
}) {
  const sites = await fetchBubbleSites(
    args.bubblesFile,
    args.tabixRefName,
    args.query,
    args.stopToken,
  )
  if (sites.length === 0) {
    return
  }

  const genomeIdx = new Map<string, number>()
  for (let i = 0; i < args.bubblesGenomeNames.length; i++) {
    genomeIdx.set(args.bubblesGenomeNames[i]!, i)
  }
  const lookupGenomeIdx = (displayName: string) => {
    const orig = args.reverseAssemblyNameMap.get(displayName) ?? displayName
    return genomeIdx.get(orig) ?? genomeIdx.get(displayName)
  }

  const refGenomeIdx = lookupGenomeIdx(args.query.assemblyName)

  for (const [genomeName, features] of args.genomeRows) {
    const gIdx = lookupGenomeIdx(genomeName)
    if (gIdx === undefined) {
      continue
    }
    for (const feat of features) {
      const startSi = lowerBoundEndGt(sites, feat.start)
      if (startSi < sites.length && sites[startSi]!.start < feat.end) {
        const result = buildCsFromCigarAndSites(
          feat,
          sites,
          startSi,
          gIdx,
          refGenomeIdx,
        )
        feat.cs = result.cs
        if (result.identityTotalBp > 0) {
          feat.identity = result.identityMatchBp / result.identityTotalBp
        }
      }
    }
  }
}
