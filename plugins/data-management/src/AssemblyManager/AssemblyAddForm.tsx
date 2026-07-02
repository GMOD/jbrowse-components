import { useState } from 'react'

import SequenceAdapterInputs from '@jbrowse/core/ui/SequenceAdapterInputs'
import {
  applyPrimaryFile,
  applyTwoBitFile,
  getBaseAssemblyConfig,
  initialFormState,
} from '@jbrowse/core/util/assemblyConfigUtils'
import { Button, DialogActions, DialogContent, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import type { AssemblyAdapter } from '@jbrowse/core/util/assemblyConfigUtils'
import type {
  AbstractSessionModel,
  FileLocation,
} from '@jbrowse/core/util/types'

const AssemblyAddForm = observer(function AssemblyAddForm({
  session,
  onClose,
}: {
  session: AbstractSessionModel
  onClose: () => void
}) {
  const [form, setForm] = useState(initialFormState)
  const {
    assemblyName,
    assemblyDisplayName,
    fastaLocation,
    faiLocation,
    gziLocation,
    twoBitLocation,
    chromSizesLocation,
  } = form

  const setPrimaryFile = (loc: FileLocation) => {
    setForm(f => applyPrimaryFile(f, loc))
  }
  const setTwoBitFile = (loc: FileLocation) => {
    setForm(f => applyTwoBitFile(f, loc))
  }

  function onSubmit() {
    if (!assemblyName.trim()) {
      session.notify("Can't create an assembly without a name")
    } else {
      onClose()
      const adapter: AssemblyAdapter = {
        IndexedFastaAdapter: {
          type: 'IndexedFastaAdapter' as const,
          fastaLocation,
          faiLocation,
        },
        BgzipFastaAdapter: {
          type: 'BgzipFastaAdapter' as const,
          fastaLocation,
          faiLocation,
          gziLocation,
        },
        FastaAdapter: {
          type: 'UnindexedFastaAdapter' as const,
          fastaLocation,
        },
        TwoBitAdapter: {
          type: 'TwoBitAdapter' as const,
          twoBitLocation,
          chromSizesLocation,
        },
      }[form.adapterSelection]
      session.addAssembly?.({
        ...getBaseAssemblyConfig(form),
        sequence: {
          type: 'ReferenceSequenceTrack',
          trackId: `${assemblyName}-${performance.now()}`,
          adapter,
        },
      })
      session.notify(`Added "${assemblyName}"`, 'success')
    }
  }

  return (
    <>
      <DialogContent>
        <TextField
          id="assembly-name"
          label="Assembly name"
          helperText="The assembly name e.g. hg38"
          variant="outlined"
          value={assemblyName}
          onChange={event => {
            const { value } = event.target
            setForm(f => ({ ...f, assemblyName: value }))
          }}
          slotProps={{
            htmlInput: { 'data-testid': 'assembly-name' },
          }}
        />
        <TextField
          id="assembly-display-name"
          label="Assembly display name"
          helperText='(optional) A human readable display name for the assembly e.g. "Homo sapiens (hg38)"'
          variant="outlined"
          value={assemblyDisplayName}
          onChange={event => {
            const { value } = event.target
            setForm(f => ({ ...f, assemblyDisplayName: value }))
          }}
          slotProps={{
            htmlInput: {
              'data-testid': 'assembly-display-name',
            },
          }}
        />
        <SequenceAdapterInputs
          form={form}
          setForm={setForm}
          setPrimaryFile={setPrimaryFile}
          setTwoBitFile={setTwoBitFile}
        />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            onSubmit()
          }}
        >
          Submit
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={() => {
            onClose()
          }}
        >
          Cancel
        </Button>
      </DialogActions>
    </>
  )
})

export default AssemblyAddForm
