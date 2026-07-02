import { useState } from 'react'

import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogActions, DialogContent, Paper } from '@mui/material'
import { observer } from 'mobx-react'

import BulkForm from './BulkForm.tsx'
import GuidedForm from './GuidedForm.tsx'
import ModeToggle from './ModeToggle.tsx'
import StagedAssemblies from './StagedAssemblies.tsx'
import {
  buildAssemblyConf,
  clearFormFields,
  formHasSequence,
  initialFormState,
} from './util.ts'

import type { Mode } from './ModeToggle.tsx'
import type { AssemblyAdapter, AssemblyConf } from './util.ts'
import type { FileLocation } from '@jbrowse/core/util/types'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()(theme => ({
  message: {
    background: theme.palette.grey[300],
    margin: theme.spacing(2),
    padding: theme.spacing(2),
  },
  paper: {
    padding: theme.spacing(2),
    margin: theme.spacing(2),
  },
}))

const OpenSequenceDialog = observer(function OpenSequenceDialog({
  onClose,
}: {
  onClose: (conf?: AssemblyConf[]) => Promise<void>
}) {
  const { classes } = useStyles()
  const [form, setForm] = useState(initialFormState)
  const [assemblyConfs, setAssemblyConfs] = useState<AssemblyConf[]>([])
  const [error, setError] = useState<unknown>()
  const [loading, setLoading] = useState('')
  const [mode, setMode] = useState<Mode>('guided')

  const formReady = !!form.assemblyName && formHasSequence(form)
  const totalToOpen = assemblyConfs.length + (formReady ? 1 : 0)

  async function indexFasta(
    fastaLocation: FileLocation,
  ): Promise<AssemblyAdapter> {
    setLoading('Creating .fai file for FASTA')
    const faiPath = await ipcRenderer.invoke('indexFasta', fastaLocation)
    return {
      type: 'IndexedFastaAdapter',
      fastaLocation,
      faiLocation: {
        localPath: faiPath,
        locationType: 'LocalPathLocation',
      },
    }
  }

  async function stageCurrentAssembly() {
    if (!form.assemblyName) {
      throw new Error('No assembly name set')
    }
    if (assemblyConfs.some(conf => conf.name === form.assemblyName)) {
      throw new Error(`Assembly "${form.assemblyName}" is already staged`)
    }
    return [...assemblyConfs, await buildAssemblyConf(form, indexFasta)]
  }

  async function runStaging(action: () => Promise<void>) {
    try {
      setError(undefined)
      await action()
    } catch (e) {
      setError(e)
      console.error(e)
    } finally {
      setLoading('')
    }
  }

  function addAnotherAssembly() {
    return runStaging(async () => {
      setAssemblyConfs(await stageCurrentAssembly())
      setForm(clearFormFields)
    })
  }

  function handleOpen() {
    return runStaging(async () => {
      const confs = formReady ? await stageCurrentAssembly() : assemblyConfs
      if (!confs.length) {
        throw new Error('No assemblies specified')
      }
      await onClose(confs)
    })
  }

  return (
    <Dialog
      open
      onClose={async () => {
        if (!loading) {
          await onClose()
        }
      }}
      title="Open genome(s)"
    >
      <DialogContent>
        {assemblyConfs.length ? (
          <StagedAssemblies
            assemblyConfs={assemblyConfs}
            onDelete={name => {
              setAssemblyConfs(assemblyConfs.filter(conf => conf.name !== name))
            }}
          />
        ) : null}

        {loading ? (
          <LoadingEllipses className={classes.message} message={loading} />
        ) : null}

        {error ? <ErrorMessage error={error} /> : null}

        <Paper className={classes.paper}>
          <ModeToggle mode={mode} setMode={setMode} disabled={!!loading} />

          {mode === 'bulk' ? (
            <BulkForm form={form} setForm={setForm} />
          ) : (
            <GuidedForm
              form={form}
              setForm={setForm}
              loading={loading}
              onStageAnother={() => {
                void addAnotherAssembly()
              }}
            />
          )}
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={() => {
            onClose().catch((e: unknown) => {
              setError(e)
            })
          }}
          color="secondary"
          disabled={!!loading}
        >
          Cancel
        </Button>
        <Button
          data-testid="open-sequence-submit"
          onClick={() => {
            void handleOpen()
          }}
          color="primary"
          disabled={!!loading || !totalToOpen}
          variant="contained"
        >
          {totalToOpen > 1 ? `Open ${totalToOpen} genomes` : 'Open'}
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default OpenSequenceDialog
