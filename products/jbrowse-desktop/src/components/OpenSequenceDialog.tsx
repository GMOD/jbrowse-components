import { useState } from 'react'

import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import AddGenomePane from '@jbrowse/core/ui/AddGenomePane'
import {
  buildAssemblyConf,
  clearFormFields,
  getAssemblyName,
  initialFormState,
  isFormReady,
} from '@jbrowse/core/util/assemblyConfigUtils'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import StagedAssemblies from './StagedAssemblies.tsx'

import type {
  AssemblyAdapter,
  AssemblyConf,
} from '@jbrowse/core/util/assemblyConfigUtils'
import type { FileLocation } from '@jbrowse/core/util/types'

const { ipcRenderer } = window.require('electron')

const useStyles = makeStyles()(theme => ({
  message: {
    background: theme.palette.grey[300],
    margin: theme.spacing(2),
    padding: theme.spacing(2),
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

  const formReady = isFormReady(form)
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
    const name = getAssemblyName(form)
    if (!name) {
      throw new Error('No assembly name set')
    }
    if (assemblyConfs.some(conf => conf.name === name)) {
      throw new Error(`Assembly "${name}" is already staged`)
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

  function handleCancel() {
    if (!loading) {
      onClose().catch((e: unknown) => {
        setError(e)
      })
    }
  }

  return (
    <Dialog
      open
      onClose={() => {
        handleCancel()
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

        <AddGenomePane
          form={form}
          setForm={setForm}
          loading={loading}
          onStageAnother={() => {
            void addAnotherAssembly()
          }}
        />

        {loading ? (
          <LoadingEllipses className={classes.message} message={loading} />
        ) : null}

        {error ? <ErrorMessage error={error} /> : null}
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          onClick={() => {
            handleCancel()
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
