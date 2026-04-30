import { flipCs } from '../csUtils.ts'

export interface BubbleEntry {
  alleleA: number
  alleleB: number
  identity: number
  cs: string
  genomesA: Set<number>
  genomesB: Set<number>
}

export type BubbleRow = BubbleEntry & { start: number; end: number }

function findAlleleForGenome(
  bubbles: BubbleEntry[],
  begin: number,
  end: number,
  gIdx: number,
) {
  for (let i = begin; i < end; i++) {
    const r = bubbles[i]!
    if (r.genomesA.has(gIdx)) {
      return r.alleleA
    }
    if (r.genomesB.has(gIdx)) {
      return r.alleleB
    }
  }
  return undefined
}

export function findBubblePairRecord(
  bubbles: BubbleEntry[],
  begin: number,
  end: number,
  gIdx: number,
  refGenomeIdx: number | undefined,
): { cs: string; identity: number } | undefined {
  const queryAllele = findAlleleForGenome(bubbles, begin, end, gIdx)
  const viewRefAllele =
    refGenomeIdx !== undefined
      ? (findAlleleForGenome(bubbles, begin, end, refGenomeIdx) ?? 0)
      : 0

  if (queryAllele === undefined || queryAllele === viewRefAllele) {
    return undefined
  }

  const lo = Math.min(viewRefAllele, queryAllele)
  const hi = Math.max(viewRefAllele, queryAllele)
  const needsFlip = viewRefAllele > queryAllele
  for (let i = begin; i < end; i++) {
    const r = bubbles[i]!
    if (r.alleleA === lo && r.alleleB === hi) {
      return {
        cs: needsFlip ? flipCs(r.cs) : r.cs,
        identity: r.identity,
      }
    }
  }
  return undefined
}

// Build a single CS string for a synteny feature by walking its CIGAR
// (structural events from segmentFeatureBuilder) and the bubble VCF detail
// in lockstep. CIGAR `=`/`M` runs are sub-walked: bubbles overlapping the
// run contribute their pair CS (SNPs/microindels), gaps fill with `:N`.
// CIGAR `D`/`N`/`I` become synthetic length-only `-`/`+` ops with `n`
// placeholder bases (the renderer reads only length, not bases).
//
// CS strictly supersedes CIGAR: once written, the renderer can ignore CIGAR
// for this feature without losing structural detail.
export function buildCsFromCigarAndBubbles(
  feat: { start: number; end: number; cigar?: string },
  bubbles: BubbleRow[],
  startBi: number,
  gIdx: number,
  refGenomeIdx: number | undefined,
) {
  const csParts: string[] = []
  let identityMatchBp = 0
  let identityTotalBp = 0
  let pos = feat.start
  let bi = startBi

  function consumeBubblesWithin(runEnd: number) {
    while (bi < bubbles.length) {
      const locusStart = bubbles[bi]!.start
      const locusEnd = bubbles[bi]!.end

      if (locusStart >= runEnd) {
        break
      }
      if (locusEnd <= pos) {
        bi++
        continue
      }
      // Bubbles whose locus straddles a run boundary cannot apply cleanly —
      // their CS describes ref bp that fall outside the alt-aligned range.
      // Skip the whole locus group; the surrounding `:gap` fills its span.
      if (locusStart < pos || locusEnd > runEnd) {
        const skipStart = locusStart
        const skipEnd = locusEnd
        while (
          bi < bubbles.length &&
          bubbles[bi]!.start === skipStart &&
          bubbles[bi]!.end === skipEnd
        ) {
          bi++
        }
        continue
      }

      if (locusStart > pos) {
        const gap = locusStart - pos
        csParts.push(`:${gap}`)
        identityMatchBp += gap
        identityTotalBp += gap
        pos = locusStart
      }

      const locusBegin = bi
      while (
        bi < bubbles.length &&
        bubbles[bi]!.start === locusStart &&
        bubbles[bi]!.end === locusEnd
      ) {
        bi++
      }
      const locusLen = locusEnd - locusStart

      const pairRecord = findBubblePairRecord(
        bubbles,
        locusBegin,
        bi,
        gIdx,
        refGenomeIdx,
      )

      if (pairRecord && pairRecord.cs.length > 0) {
        csParts.push(pairRecord.cs)
        identityMatchBp += pairRecord.identity * locusLen
      } else {
        csParts.push(`:${locusLen}`)
        identityMatchBp += locusLen
      }
      identityTotalBp += locusLen
      pos = locusEnd
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
    consumeBubblesWithin(feat.end)
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
        // X (mismatch run) is processed like = so bubble CS supplies the
        // per-base detail. segmentFeatureBuilder emits X for equal-length
        // segment swaps (alt-allele SNVs); bubble pairRecord cs has the
        // *xy ops. Fallback inside consumeBubblesWithin emits :N when no
        // pair record found, which loses the mismatch info but keeps
        // identity numerics correct.
        consumeBubblesWithin(pos + cigarLen)
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
