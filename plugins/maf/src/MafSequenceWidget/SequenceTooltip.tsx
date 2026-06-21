import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { Sample } from '../types.ts'

const useStyles = makeStyles()(theme => ({
  insertion: {
    color: theme.palette.warning.light,
    fontStyle: 'italic',
  },
}))

interface SequenceTooltipProps {
  x: number
  y: number
  sample: Sample
  base?: string
  genomicPos?: number
}

// Controlled `clientPoint` (not pointer-tracking): the widget already
// re-renders per mouse move, so positioning rides that render with no window
// listener or per-move allocation. See ADR-028.
export default function SequenceTooltip({
  x,
  y,
  sample,
  base,
  genomicPos,
}: SequenceTooltipProps) {
  const { classes } = useStyles()

  // An insertion is when we have a base but no genomic position (the reference
  // has a gap at this column).
  const isInsertion = base !== undefined && genomicPos === undefined

  return (
    <BaseTooltip clientPoint={{ x, y }}>
      <div>
        <strong>{sample.label}</strong>
      </div>
      {base ? (
        <div>
          Base: {base}
          {genomicPos !== undefined
            ? ` | Pos: ${(genomicPos + 1).toLocaleString('en-US')}`
            : null}
        </div>
      ) : null}
      {isInsertion ? (
        <div className={classes.insertion}>Insertion (not in reference)</div>
      ) : null}
    </BaseTooltip>
  )
}
