import { toLocale } from '@jbrowse/core/util'

import type { CoverageTooltipBin } from './coverageDownsampling.ts'

/** "chr1:1,235" — the 1-based locale spelling of a 0-based position. */
export function formatBandLocation(
  refName: string | undefined,
  position: number,
) {
  const pos = toLocale(position + 1)
  return refName ? `${refName}:${pos}` : pos
}

export function pct(n: number, total: number) {
  return `${((n / (total || 1)) * 100).toFixed(1)}%`
}

/**
 * "12/40 (30.0%)". A zero total reports the bare count: `interbaseDepthAt` is
 * 0 for an event at the edge of the coverage array, and a share of nothing is
 * not a number — that case used to render "3/0 (300.0%)".
 */
export function countOfTotal(count: number, total: number) {
  return total > 0 ? `${count}/${total} (${pct(count, total)})` : `${count}`
}

/** "5bp" when the range collapses, "5-8bp" otherwise. */
export function formatLenRange(minLen: number, maxLen: number) {
  return minLen === maxLen ? `${minLen}bp` : `${minLen}-${maxLen}bp`
}

// "18(+) 22(-)", or nothing when the sweep collected no per-strand tally — a
// row reporting "0(+) 0(-)" for want of the data says something false.
function strandCounts(fwd: number, rev: number) {
  return fwd > 0 || rev > 0 ? `${fwd}(+) ${rev}(-)` : undefined
}

/** The depth half of a bin: interbase events are reached by hovering their bars. */
export type CoverageRowsBin = Omit<
  CoverageTooltipBin,
  'interbase' | 'interbaseDepth'
>

/**
 * One line of the coverage breakdown at a position. `color` is a
 * modification's own; `base` names an allele, whose colour the display looks
 * up in its own palette.
 */
export interface CoverageRow {
  key: string
  label: string
  color?: string
  base?: string
  reads: string
  avgProb?: string
  strands?: string
}

/** The coverage breakdown at one position, in display order. */
export function coverageRows(bin: CoverageRowsBin): CoverageRow[] {
  const { depth, fwdDepth, revDepth, snps, deletions, modifications } = bin
  // Descending by count, tie-broken by base: `Object.entries` is insertion
  // order, so the same locus listed its alleles differently after a pan.
  const snpEntries = Object.entries(snps).sort(
    ([aBase, a], [bBase, b]) => b.count - a.count || aBase.localeCompare(bBase),
  )
  const modEntries = modifications
    ? [...modifications].sort((a, b) => a.name.localeCompare(b.name))
    : []
  const totalStrands =
    fwdDepth !== undefined && revDepth !== undefined
      ? { fwd: fwdDepth, rev: revDepth }
      : undefined
  const rows: CoverageRow[] = [
    {
      key: 'total',
      label: 'Total',
      reads: `${depth}`,
      strands: totalStrands
        ? strandCounts(totalStrands.fwd, totalStrands.rev)
        : undefined,
    },
  ]
  // Modification rows sit alongside the allele rows rather than instead of
  // them: at a CpG the A/C/G/T breakdown and the methylation calls are exactly
  // the pair worth disambiguating.
  for (const mod of modEntries) {
    rows.push({
      key: `${mod.name}-${mod.color}`,
      label: mod.name,
      color: mod.color,
      reads: countOfTotal(mod.count, depth),
      avgProb: `${((mod.count > 0 ? mod.probabilityTotal / mod.count : 0) * 100).toFixed(1)}%`,
      strands: strandCounts(mod.fwd, mod.rev),
    })
  }
  // The reference allele: `depth` counts everything over the position and
  // `snps` holds mismatches only, so the difference is the count a reader at a
  // het site is after. No row without an alt to weigh it against.
  if (snpEntries.length > 0 && depth > 0) {
    const altReads = snpEntries.reduce((sum, [, d]) => sum + d.count, 0)
    const altFwd = snpEntries.reduce((sum, [, d]) => sum + d.fwd, 0)
    const altRev = snpEntries.reduce((sum, [, d]) => sum + d.rev, 0)
    rows.push({
      key: 'ref',
      label: 'Ref',
      reads: countOfTotal(Math.max(0, depth - altReads), depth),
      strands: totalStrands
        ? strandCounts(
            Math.max(0, totalStrands.fwd - altFwd),
            Math.max(0, totalStrands.rev - altRev),
          )
        : undefined,
    })
  }
  for (const [base, data] of snpEntries) {
    rows.push({
      key: base,
      label: base.toUpperCase(),
      base,
      reads: countOfTotal(data.count, depth),
      strands: strandCounts(data.fwd, data.rev),
    })
  }
  if (deletions) {
    rows.push({
      key: 'deletion',
      // A deleted base is absent from the read and so out of `depth`, which
      // makes the share one of depth + deletions.
      label: `Deletion (${formatLenRange(deletions.minLen, deletions.maxLen)})`,
      reads: countOfTotal(deletions.count, depth + deletions.count),
    })
  }
  return rows
}
