import { Checkbox, FormControlLabel } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from '@jbrowse/core/util/tss-react'

import type { SvInspectorViewModel } from '../model'

const useStyles = makeStyles()(theme => ({
  circularViewOptions: {
    padding: theme.spacing(1),
  },
}))

const CircularViewOptions = observer(function ({
  svInspector,
}: {
  svInspector: SvInspectorViewModel
}) {
  const { classes } = useStyles()

  return (
    <div
      className={classes.circularViewOptions}
      style={{ height: svInspector.circularViewOptionsBarHeight }}
    >
      <FormControlLabel
        control={
          <Checkbox
            checked={svInspector.onlyDisplayRelevantRegionsInCircularView}
            onChange={e => {
              svInspector.setOnlyDisplayRelevantRegionsInCircularView(
                e.target.checked,
              )
            }}
          />
        }
        label="show only regions with data"
      />
    </div>
  )
})

export default CircularViewOptions
