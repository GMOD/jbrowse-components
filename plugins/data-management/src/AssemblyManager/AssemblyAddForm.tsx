import { useState } from 'react'

import AddGenomePane from '@jbrowse/core/ui/AddGenomePane'
import {
  buildAssemblyConf,
  initialFormState,
  isFormReady,
} from '@jbrowse/core/util/assemblyConfigUtils'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

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
  const ready = isFormReady(form)

  async function onSubmit() {
    try {
      // web has no samtools faidx, so a plain FASTA stays unindexed
      const conf = await buildAssemblyConf(form, (fastaLocation: FileLocation) => ({
        type: 'UnindexedFastaAdapter' as const,
        fastaLocation,
      }))
      session.addAssembly?.(conf)
      session.notify(`Added "${conf.name}"`, 'success')
      onClose()
    } catch (e) {
      console.error(e)
      session.notify(`${e}`, 'error')
    }
  }

  return (
    <>
      <DialogContent>
        <AddGenomePane form={form} setForm={setForm} />
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          disabled={!ready}
          onClick={() => {
            onSubmit().catch((e: unknown) => {
              console.error(e)
            })
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
