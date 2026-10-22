import { Suspense } from 'react'

import { getEnv } from '@jbrowse/core/util'
import {
  FormControl,
  FormHelperText,
  ListSubheader,
  MenuItem,
  Select,
} from '@mui/material'
import { observer } from 'mobx-react'

import type { AddTrackModel } from '../model.ts'

const AddTrackSelector = observer(function AddTrackSelector({
  model,
}: {
  model: AddTrackModel
}) {
  const { pluginManager } = getEnv(model)
  const workflows = pluginManager.getAddTrackWorkflowElements()
  const general = workflows.filter(w => w.category === 'general')
  const specialized = workflows.filter(w => w.category === 'specialized')

  // fall back to the first if the selected workflow's plugin is unavailable
  const selected =
    workflows.find(w => w.name === model.workflowName) ?? workflows[0]
  if (!selected) {
    return null
  }
  const { ReactComponent } = selected
  return (
    <>
      <FormControl>
        <Select
          value={selected.name}
          onChange={event => {
            model.setWorkflowName(event.target.value)
          }}
        >
          <ListSubheader>General</ListSubheader>
          {general.map(w => (
            <MenuItem key={w.name} value={w.name}>
              {w.displayName}
            </MenuItem>
          ))}
          {specialized.length ? (
            <ListSubheader>Specialized track types</ListSubheader>
          ) : null}
          {specialized.map(w => (
            <MenuItem key={w.name} value={w.name}>
              {w.displayName}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>Choose how to add a track</FormHelperText>
      </FormControl>

      <Suspense fallback={null}>
        <ReactComponent
          model={model}
          switchWorkflow={name => {
            model.setWorkflowName(name)
          }}
        />
      </Suspense>
    </>
  )
})

export default AddTrackSelector
