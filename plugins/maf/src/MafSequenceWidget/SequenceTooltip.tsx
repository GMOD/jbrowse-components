import React from 'react'

import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { Sample } from '../types.ts'

const useStyles = makeStyles()(theme => ({
  tooltip: {
    position: 'fixed',
    pointerEvents: 'none',
    zIndex: 1000,
    backgroundColor: theme.palette.grey[800],
    color: theme.palette.common.white,
    padding: '4px 8px',
    borderRadius: 4,
    fontSize: 12,
    whiteSpace: 'nowrap',
  },
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

export default function SequenceTooltip({
  x,
  y,
  sample,
  base,
  genomicPos,
}: SequenceTooltipProps) {
  const { classes } = useStyles()

  // An insertion is when we have a base but no genomic position
  // (the reference has a gap at this column)
  const isInsertion = base !== undefined && genomicPos === undefined

  return (
    <div
      className={classes.tooltip}
      style={{
        left: x + 12,
        top: y + 12,
      }}
    >
      <div>
        <strong>{sample.label}</strong>
      </div>
      {base && (
        <div>
          Base: {base}
          {genomicPos !== undefined
            ? ` | Pos: ${(genomicPos + 1).toLocaleString('en-US')}`
            : null}
        </div>
      )}
      {isInsertion && (
        <div className={classes.insertion}>Insertion (not in reference)</div>
      )}
    </div>
  )
}
