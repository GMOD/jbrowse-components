/* eslint-disable tss-unused-classes/unused-classes -- shared across the MAF tooltip components */
import { makeStyles } from '@jbrowse/core/util/tss-react'

/**
 * Shared table styling for the MAF tooltip contents (coverage, interbase,
 * alignment) so the bordered compact-table look stays in one place.
 */
export const useTooltipStyles = makeStyles()(theme => ({
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
