import { LabeledCheckbox } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { circularViewOptionsBarHeight } from '../consts.ts'

import type { SvInspectorViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  // the model subtracts exactly this height, so center rather than pad
  circularViewOptions: {
    height: circularViewOptionsBarHeight,
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(0, 1),
    overflow: 'hidden',
  },
}))

const CircularViewOptions = observer(function CircularViewOptions({
  svInspector,
}: {
  svInspector: SvInspectorViewModel
}) {
  const { classes } = useStyles()

  return (
    <div className={classes.circularViewOptions}>
      <LabeledCheckbox
        checked={svInspector.onlyDisplayRelevantRegionsInCircularView}
        onChange={val => {
          svInspector.setOnlyDisplayRelevantRegionsInCircularView(val)
        }}
        label="show only regions with data"
      />
    </div>
  )
})

export default CircularViewOptions
