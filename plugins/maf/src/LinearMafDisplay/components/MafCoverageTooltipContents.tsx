import React from 'react'

import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { CoverageTooltipBin } from '@jbrowse/alignments-core'

const useStyles = makeStyles()(theme => ({
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

/**
 * Depth + SNP-base-counts table for the MAF coverage band. Consumes the same
 * `CoverageTooltipBin` shape the alignments display uses (built via
 * alignments-core's `buildCoverageTooltipBin`). Insertions are shown by the
 * separate `MafInterbaseTooltipContents` (interbase events are not mixed into
 * the depth table), mirroring the alignments indicator-vs-coverage split.
 */
export default function MafCoverageTooltipContents({
  bin,
  refName,
}: {
  bin: CoverageTooltipBin
  refName?: string
}) {
  const { classes } = useStyles()
  const { position, depth, snps } = bin
  const pos = toLocale(position + 1)
  const location = refName ? `${refName}:${pos}` : pos
  return (
    <table className={classes.table}>
      <caption>Coverage - {location}</caption>
      <thead>
        <tr>
          <th>Base</th>
          <th>Samples</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Total</td>
          <td>{depth}</td>
        </tr>
        {Object.entries(snps).map(([base, data]) => (
          <tr key={base}>
            <td>{base.toUpperCase()}</td>
            <td className={classes.td}>
              {data.count}/{depth} ({((data.count / depth) * 100).toFixed(1)}%)
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
