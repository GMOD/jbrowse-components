import { makeStyles } from '@jbrowse/core/util/tss-react'

import {
  countOfTotal,
  coverageRows,
  formatLenRange,
} from './coverageBandTooltip.ts'

import type { CoverageRowsBin } from './coverageBandTooltip.ts'
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
