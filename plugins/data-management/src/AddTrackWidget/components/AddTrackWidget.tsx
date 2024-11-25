import React, { Suspense, useState } from 'react'
import { getEnv } from '@jbrowse/core/util'
import { FormControl, FormHelperText, Select, MenuItem } from '@mui/material'
import { observer } from 'mobx-react'

// locals
import DefaultAddTrackWorkflow from './DefaultAddTrackWorkflow'
import PasteConfigWorkflow from './PasteConfigWorkflow'
import type { AddTrackModel } from '../model'

const AddTrackSelector = observer(function ({
  model,
}: {
  model: AddTrackModel
}) {
  const [val, setVal] = useState('Default add track workflow')
  const ComponentMap = {
    'Default add track workflow': DefaultAddTrackWorkflow,
    'Add track JSON': PasteConfigWorkflow,
    ...Object.fromEntries(
      getEnv(model)
        .pluginManager.getAddTrackWorkflowElements()
        .map(w => [w.name, w.ReactComponent]),
    ),
  } as Record<string, React.FC<{ model: AddTrackModel }>>

  // make sure the selected value is in the list
  const val2 = ComponentMap[val] ? val : 'Default add track workflow'
  const Component = ComponentMap[val2]!
  return (
    <>
      <FormControl>
        <Select
          value={val2}
          onChange={event => {
            setVal(event.target.value)
          }}
        >
          {Object.keys(ComponentMap).map(e => (
            <MenuItem key={e} value={e}>
              {e}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>Type of add track workflow</FormHelperText>
      </FormControl>

      <Suspense fallback={null}>
        <Component model={model} />
      </Suspense>
    </>
  )
})

export default AddTrackSelector
