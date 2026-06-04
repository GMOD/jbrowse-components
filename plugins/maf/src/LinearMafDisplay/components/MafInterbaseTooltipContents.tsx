import React from 'react'

import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { CoverageInsertionHit } from '../coverageInsertion.ts'

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

function sizeStr(minLen: number, maxLen: number) {
  return minLen === maxLen ? `${minLen} bp` : `${minLen}-${maxLen} bp`
}

/**
 * Interbase (insertion) summary for the MAF coverage band — the count of
 * samples carrying an insertion at this boundary and their length range.
 * Separate from `MafCoverageTooltipContents` (depth/SNPs) so insertion data is
 * never mixed with coverage data, mirroring the alignments indicator tooltip.
 */
export default function MafInterbaseTooltipContents({
  hit,
  refName,
}: {
  hit: CoverageInsertionHit
  refName?: string
}) {
  const { classes } = useStyles()
  const { position, interbaseDepth, count, minLen, maxLen } = hit
  const pos = toLocale(position + 1)
  const location = refName ? `${refName}:${pos}` : pos
  return (
    <table className={classes.table}>
      <caption>Interbase - {location}</caption>
      <thead>
        <tr>
          <th>Type</th>
          <th>Samples</th>
          <th>Size</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Insertion</td>
          <td className={classes.td}>
            {count}/{interbaseDepth} (
            {((count / (interbaseDepth || 1)) * 100).toFixed(1)}%)
          </td>
          <td className={classes.td}>{sizeStr(minLen, maxLen)}</td>
        </tr>
      </tbody>
    </table>
  )
}
