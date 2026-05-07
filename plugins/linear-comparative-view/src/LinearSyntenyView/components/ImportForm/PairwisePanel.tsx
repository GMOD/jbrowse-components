import { AssemblySelector } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

import type { LinearSyntenyViewModel } from '../../model.ts'

const PairwisePanel = observer(function PairwisePanel({
  model,
  selectedAssemblyNames,
  setSelectedAssemblyNames,
  onLaunch,
}: {
  model: LinearSyntenyViewModel
  selectedAssemblyNames: string[]
  setSelectedAssemblyNames: (names: string[]) => void
  onLaunch: () => void
}) {
  const session = getSession(model)
  const selection = model.importFormSyntenyTrackSelections[0]
  const canLaunch =
    !!selection && !(selection.type === 'preConfigured' && !selection.value)

  return (
    <>
      <div style={{ marginBottom: 10 }}>Select two assemblies to compare</div>
      {selectedAssemblyNames.map((name, idx) => (
        <AssemblySelector
          key={idx}
          helperText=""
          selected={name}
          onChange={newAssembly => {
            setSelectedAssemblyNames(
              selectedAssemblyNames.map((asm, i) =>
                i === idx ? newAssembly : asm,
              ),
            )
          }}
          session={session}
        />
      ))}
      <Button
        sx={{ mt: 2 }}
        disabled={!canLaunch}
        onClick={onLaunch}
        variant="contained"
        color="primary"
      >
        Launch
      </Button>
    </>
  )
})

export default PairwisePanel
