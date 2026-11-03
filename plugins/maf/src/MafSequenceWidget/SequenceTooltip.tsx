import BaseTooltip from '@jbrowse/core/ui/BaseTooltip'
import { lighten } from '@jbrowse/core/ui/palette'
import { toLocale } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import type { MafSource } from '../types.ts'

const useStyles = makeStyles()(theme => ({
  insertion: {
    color: lighten(theme.palette.insertion, 0.6),
    fontStyle: 'italic',
  },
}))

const GAP = '-'

interface SequenceTooltipProps {
  x: number
  y: number
  sample: MafSource
  base?: string
  genomicPos?: number
}

// Controlled `clientPoint` (not pointer-tracking): the widget already
// re-renders per mouse move, so positioning rides that render with no window
// listener or per-move allocation. See ADR-028.
const SequenceTooltip = observer(function SequenceTooltip({
  x,
  y,
  sample,
  base,
  genomicPos,
}: SequenceTooltipProps) {
  const { classes } = useStyles()

  const isInsertion =
    base !== undefined && base !== GAP && genomicPos === undefined

  return (
    <BaseTooltip clientPoint={{ x, y }}>
      <div>
        <strong>{sample.label}</strong>
      </div>
      {base ? (
        <div>
          Base: {base}
          {genomicPos !== undefined
            ? ` | Pos: ${toLocale(genomicPos + 1)}`
            : null}
        </div>
      ) : null}
      {isInsertion ? (
        <div className={classes.insertion}>Insertion (not in reference)</div>
      ) : null}
    </BaseTooltip>
  )
})

export default SequenceTooltip
