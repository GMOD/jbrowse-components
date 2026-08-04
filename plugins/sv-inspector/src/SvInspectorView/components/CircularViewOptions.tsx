import { LabeledCheckbox } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { observer } from 'mobx-react'

import { circularViewOptionsBarHeight } from '../model.ts'

import type { SvInspectorViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  circularViewOptions: {
    padding: theme.spacing(1),
  },
}))

const CircularViewOptions = observer(function CircularViewOptions({
  svInspector,
}: {
  svInspector: SvInspectorViewModel
}) {
  const { classes } = useStyles()

  return (
    <div
      className={classes.circularViewOptions}
      style={{ height: circularViewOptionsBarHeight }}
    >
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
