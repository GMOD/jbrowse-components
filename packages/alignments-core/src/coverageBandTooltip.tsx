import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { CoverageTooltipBin } from './coverageDownsampling.ts'
import type { ReactNode } from 'react'

/** The compact bordered table every band tooltip renders. */
export const useTooltipTableStyles = makeStyles()(theme => ({
  td: {
    whiteSpace: 'nowrap',
  },
  table: {
    fontSize: theme.typography.fontSize * 0.85,
    borderCollapse: 'collapse',
    '& td, & th': {
      border: '1px solid rgba(255,255,255,0.3)',
      padding: '2px 4px',
    },
  },
}))

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

function ColorSwatch({ color }: { color: string }) {
  return <div style={{ width: 10, height: 10, background: color }} />
}

/**
 * The depth, allele, deletion and modification breakdown at one band
 * position. `unit` names what is counted ("Reads", "Samples"); `swatchFor`
 * colours an allele row the way the display's SNP slices are drawn, and
 * leaving it out drops the swatch column; `children` land under the table.
 */
export function CoverageTooltipTable({
  bin,
  location,
  unit = 'Reads',
  swatchFor,
  children,
}: {
  bin: CoverageRowsBin
  location: string
  unit?: string
  swatchFor?: (base: string) => string | undefined
  children?: ReactNode
}) {
  const { classes } = useTooltipTableStyles()
  const rows = coverageRows(bin)
  const swatches =
    swatchFor !== undefined &&
    rows.some(r => r.color !== undefined || r.base !== undefined)
  const avgProb = rows.some(r => r.avgProb !== undefined)
  const strands = rows.some(r => r.strands !== undefined)
  return (
    <>
      <table className={classes.table}>
        <caption>Coverage - {location}</caption>
        <thead>
          <tr>
            {swatches ? <th /> : null}
            <th>Base</th>
            <th>{unit}</th>
            {avgProb ? <th>Avg Prob</th> : null}
            {strands ? <th>Strands</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const swatch =
              row.base === undefined ? row.color : swatchFor?.(row.base)
            return (
              <tr key={row.key}>
                {swatches ? (
                  <td>{swatch ? <ColorSwatch color={swatch} /> : null}</td>
                ) : null}
                <td>{row.label}</td>
                <td className={classes.td}>{row.reads}</td>
                {avgProb ? <td>{row.avgProb}</td> : null}
                {strands ? <td className={classes.td}>{row.strands}</td> : null}
              </tr>
            )
          })}
        </tbody>
      </table>
      {children}
    </>
  )
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * The interbase events at one band boundary, per type. Separate from the
 * depth table so an insertion is never counted into a column it sits beside.
 */
export function InterbaseTooltipTable({
  interbase,
  total,
  location,
  unit = 'Reads',
  typeLabel = capitalize,
}: {
  interbase: CoverageTooltipBin['interbase']
  total: number
  location: string
  unit?: string
  typeLabel?: (type: string) => string
}) {
  const { classes } = useTooltipTableStyles()
  return (
    <table className={classes.table}>
      <caption>Interbase - {location}</caption>
      <thead>
        <tr>
          <th>Type</th>
          <th>{unit}</th>
          <th>Size</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Total</td>
          <td>{total}</td>
          <td />
        </tr>
        {Object.entries(interbase).map(([type, data]) => (
          <tr key={type}>
            <td>
              {typeLabel(type)}
              {data.topSeq && data.minLen <= 10
                ? ` (most frequent ${data.topSeq})`
                : null}
            </td>
            <td className={classes.td}>{countOfTotal(data.count, total)}</td>
            <td className={classes.td}>
              {data.minLen > 0 || data.maxLen > 0
                ? formatLenRange(data.minLen, data.maxLen)
                : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
