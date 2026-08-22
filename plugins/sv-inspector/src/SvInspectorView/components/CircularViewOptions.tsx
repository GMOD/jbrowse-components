import { LabeledCheckbox } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { circularViewOptionsBarHeight } from '../consts.ts'

import type { SvInspectorViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  // the bar's height is a contract: the model subtracts exactly this much from
  // the circular view's height. So the control is centered inside it rather
  // than padded vertically, which stacked a medium checkbox's own 42px onto
  // 16px of padding and bled 6px over the top of the circle
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
