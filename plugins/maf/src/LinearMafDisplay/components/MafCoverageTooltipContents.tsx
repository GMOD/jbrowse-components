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
  // `identity` is the maf-local percent identity (0..1) attached to the bin by
  // the display's `coverageTooltipBin`; the rest is the shared alignments-core
  // `CoverageTooltipBin`.
  bin: CoverageTooltipBin & { identity?: number }
  refName?: string
}) {
  const { classes } = useStyles()
  const { position, depth, snps, identity } = bin
  const pos = toLocale(position + 1)
  const location = refName ? `${refName}:${pos}` : pos
  return (
    <>
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
                {data.count}/{depth} ({((data.count / depth) * 100).toFixed(1)}
                %)
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {identity !== undefined && Number.isFinite(identity) ? (
        // Percent identity excludes the reference row; a sample N/IUPAC code
        // counts as a mismatch (same policy as the SNP coloring).
        <div className={classes.td}>
          Identity: {(identity * 100).toFixed(1)}%
        </div>
      ) : null}
    </>
  )
}
