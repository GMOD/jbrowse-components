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

interface WorkflowEntry {
  name: string
  displayName: string
  Component: WorkflowComponent
}

const AddTrackSelector = observer(function AddTrackSelector({
  model,
}: {
  model: AddTrackModel
}) {
  const [val, setVal] = useState(DEFAULT_WORKFLOW)
  const { pluginManager } = getEnv(model)
  const workflows = useMemo<WorkflowEntry[]>(
    () => [
      {
        name: DEFAULT_WORKFLOW,
        displayName: 'Add a track from file or URL',
        Component: DefaultAddTrackWorkflow,
      },
      {
        name: PASTE_JSON_WORKFLOW,
        displayName: 'Add track from pasted JSON',
        Component: PasteConfigWorkflow,
      },
      ...pluginManager.getAddTrackWorkflowElements().map(w => ({
        name: w.name,
        displayName: w.displayName,
        Component: w.ReactComponent as WorkflowComponent,
      })),
    ],
    [pluginManager],
  )

  // fall back to the default if the selected workflow's plugin is unavailable
  const selected = workflows.find(w => w.name === val) ?? workflows[0]!
  const { Component } = selected
  return (
    <>
      <FormControl>
        <Select
          value={selected.name}
          onChange={event => {
            setVal(event.target.value)
          }}
        >
          {workflows.map(w => (
            <MenuItem key={w.name} value={w.name}>
              {w.displayName}
            </MenuItem>
          ))}
        </Select>
        <FormHelperText>Choose how to add a track</FormHelperText>
      </FormControl>

      <Suspense fallback={null}>
        <Component model={model} switchWorkflow={setVal} />
      </Suspense>
    </>
  )
})

export default AddTrackSelector
