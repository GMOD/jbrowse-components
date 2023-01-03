import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { FormControl, FormHelperText, Select, MenuItem } from '@mui/material'
import { getEnv } from '@jbrowse/core/util'

// locals
import { AddTrackModel } from '../model'
import DefaultAddTrackWorkflow from './DefaultAddTrackWorkflow'
import PasteConfigWorkflow from './PasteConfigWorkflow'

function AddTrackSelector({ model }: { model: AddTrackModel }) {
  const [val, setVal] = useState('Default add track workflow')
  const { pluginManager } = getEnv(model)
  const widgets = pluginManager.getAddTrackWorkflowElements()
  const ComponentMap = {
    'Default add track workflow': DefaultAddTrackWorkflow,
    'Add track JSON': PasteConfigWorkflow,
    ...Object.fromEntries(widgets.map(w => [w.name, w.ReactComponent])),
  } as { [key: string]: React.FC<{ model: AddTrackModel }> }

  // make sure the selected value is in the list
  const val2 = ComponentMap[val] ? val : 'Default add track workflow'
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
