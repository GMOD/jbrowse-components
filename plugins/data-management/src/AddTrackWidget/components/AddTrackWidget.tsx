import { Suspense, useMemo, useState } from 'react'

import { getEnv } from '@jbrowse/core/util'
import { FormControl, FormHelperText, MenuItem, Select } from '@mui/material'
import { observer } from 'mobx-react'

import DefaultAddTrackWorkflow from './DefaultAddTrackWorkflow.tsx'
import PasteConfigWorkflow from './PasteConfigWorkflow.tsx'
import { DEFAULT_WORKFLOW, PASTE_JSON_WORKFLOW } from '../workflowNames.ts'

import type { AddTrackModel } from '../model.ts'

type WorkflowComponent = React.FC<{
  model: AddTrackModel
  switchWorkflow: (name: string) => void
}>

const AddTrackSelector = observer(function AddTrackSelector({
  model,
}: {
  model: AddTrackModel
}) {
  const [val, setVal] = useState(DEFAULT_WORKFLOW)
  const { pluginManager } = getEnv(model)
  const componentMap = useMemo(() => {
    const map = new Map<string, WorkflowComponent>([
      [DEFAULT_WORKFLOW, DefaultAddTrackWorkflow],
      [PASTE_JSON_WORKFLOW, PasteConfigWorkflow],
    ])
    for (const w of pluginManager.getAddTrackWorkflowElements()) {
      map.set(w.name, w.ReactComponent as WorkflowComponent)
    }
    return map
  }, [pluginManager])

  // make sure the selected value is in the list
  const val2 = componentMap.has(val) ? val : DEFAULT_WORKFLOW
  const Component = componentMap.get(val2)!
  return (
    <>
      <FormControl>
        <Select
          value={val2}
          onChange={event => {
            setVal(event.target.value)
          }}
        >
          {[...componentMap.keys()].map(e => (
            <MenuItem key={e} value={e}>
              {e}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>Type of add track workflow</FormHelperText>
      </FormControl>

      <Suspense fallback={null}>
        <Component model={model} switchWorkflow={setVal} />
      </Suspense>
    </>
  )
})

export default AddTrackSelector
