import React from 'react'
import { observer } from 'mobx-react'
import { FormControl, FormHelperText, Select, MenuItem } from '@mui/material'
import { AddTrackWorkflowType } from '@jbrowse/core/pluggableElementTypes'
import { getEnv, useLocalStorage } from '@jbrowse/core/util'

// locals
import { AddTrackModel } from '../model'
import DefaultAddTrackWorkflow from './DefaultAddTrackWorkflow'

function AddTrackSelector({ model }: { model: AddTrackModel }) {
  const [val, setVal] = useLocalStorage('trackSelector-choice', 'Default')
  const { pluginManager } = getEnv(model)
  const widgets = pluginManager.getElementTypesInGroup(
    'add track workflow',
  ) as AddTrackWorkflowType[]
  const ComponentMap = {
    Default: DefaultAddTrackWorkflow,
    ...Object.fromEntries(widgets.map(w => [w.name, w.ReactComponent])),
  } as { [key: string]: React.FC<{ model: AddTrackModel }> }

  // make sure the selected value is in the list
  const val2 = ComponentMap[val] ? val : 'Default'
  const Component = ComponentMap[val2]
  return (
    <>
      <FormControl>
        <Select value={val2} onChange={event => setVal(event.target.value)}>
          {Object.keys(ComponentMap).map(e => (
            <MenuItem key={e} value={e}>
              {e}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>Type of add track workflow</FormHelperText>
      </FormControl>

      <br />
      <Component model={model} />
    </>
  )
}

export default observer(AddTrackSelector)
