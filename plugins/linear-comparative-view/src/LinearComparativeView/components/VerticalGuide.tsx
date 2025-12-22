import { stringify } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearComparativeViewModel } from '../model'

type LCV = LinearComparativeViewModel

const useStyles = makeStyles()({
  guide: {
    pointerEvents: 'none',
    height: '100%',
    width: 1,
    position: 'absolute',
    background: 'red',
    zIndex: 1001,
  },
})

const VerticalGuide = observer(function VerticalGuide({
  model,
  coordX,
}: {
  model: LCV
  coordX: number
}) {
  const { classes } = useStyles()
  return (
    <Tooltip
      open
      placement="top"
      title={model.views
        .map(view => view.pxToBp(coordX))
        .map((elt, idx) => (
          <div key={[JSON.stringify(elt), idx].join('-')}>
            {stringify(elt, true)}
          </div>
        ))}
      arrow
    >
      <div
        className={classes.guide}
        style={{
          left: coordX,
        }}
      />
    </Tooltip>
  )
})

export default VerticalGuide
