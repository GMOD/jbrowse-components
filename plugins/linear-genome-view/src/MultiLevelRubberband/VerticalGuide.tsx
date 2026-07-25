import { stringify } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import GuideLabel from '../shared/GuideLabel.tsx'

import type { MultiLevelRubberbandModel } from './types.ts'

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
  model: MultiLevelRubberbandModel
  coordX: number
}) {
  const { classes } = useStyles()
  const { views } = model
  return (
    <>
      <GuideLabel
        coordX={coordX}
        viewWidth={Math.min(...views.map(view => view.width))}
        stickyTop={undefined}
      >
        {views.map(view => (
          <div key={view.id}>{stringify(view.pxToBp(coordX), true)}</div>
        ))}
      </GuideLabel>
      <div className={classes.guide} style={{ left: coordX }} />
    </>
  )
})

export default VerticalGuide
