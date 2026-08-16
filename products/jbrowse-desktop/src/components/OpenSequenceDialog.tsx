import { useState } from 'react'

import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import AddGenomePane from '@jbrowse/core/ui/AddGenomePane'
import {
  buildAssemblyConf,
  clearFormFields,
  getAssemblyName,
  initialFormState,
  isFormDirty,
  isFormReady,
} from '@jbrowse/core/util/assemblyConfigUtils'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogActions, DialogContent } from '@mui/material'
import { observer } from 'mobx-react'

import { invokeIpc } from '../ipc.ts'
import StagedAssemblies from './StagedAssemblies.tsx'

import type {
  AssemblyAdapter,
  AssemblyConf,
} from '@jbrowse/core/util/assemblyConfigUtils'
import type { FileLocation } from '@jbrowse/core/util/types'

const useStyles = makeStyles()(theme => ({
  message: {
    background: theme.palette.grey[300],
    margin: theme.spacing(2),
    padding: theme.spacing(2),
  },
}))

const OpenSequenceDialog = observer(function OpenSequenceDialog({
  onClose,
  existingAssemblyNames = [],
}: {
  onClose: (conf?: AssemblyConf[]) => Promise<void>
  existingAssemblyNames?: string[]
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
    // Narrowing, not a case that happens: core hands desktop a localPath (a
    // uri if the user typed a url) because both producers branch on isElectron
    // — LocalFileChooser's picker and fileToLocation's drag-and-drop — so the
    // blob and file-handle members of FileLocation are unreachable here. The
    // union still includes them and the main process can index neither, so say
    // so out loud rather than send it a location it would read as `undefined`.
    if (!('localPath' in fastaLocation) && !('uri' in fastaLocation)) {
      throw new Error(
        `Cannot index a FASTA at this location type: ${fastaLocation.locationType}`,
      )
    }
    setLoading('Creating .fai file for FASTA')
    const faiPath = await invokeIpc('indexFasta', fastaLocation)
    return {
      type: 'IndexedFastaAdapter',
      fastaLocation,
      faiLocation: {
        localPath: faiPath,
        locationType: 'LocalPathLocation',
      },
    }
  }

  // Both name checks happen before buildAssemblyConf, which on a plain FASTA
  // runs faidx over the whole file — a name that was never going to be accepted
  // shouldn't cost that first.
  async function stageCurrentAssembly() {
    const name = getAssemblyName(form)
    if (!name) {
      throw new Error('No assembly name set')
    }
    if (assemblyConfs.some(conf => conf.name === name)) {
      throw new Error(`Assembly "${name}" is already staged`)
    }
    if (existingAssemblyNames.includes(name)) {
      throw new Error(
        `An assembly named "${name}" is already open. Give this one a different name.`,
      )
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
      // A genome half-entered below the staged list is refused rather than
      // dropped: submitting the staged ones alone would open something, look
      // like it worked, and leave the one being typed nowhere.
      if (!formReady && isFormDirty(form)) {
        throw new Error(
          'Finish the genome you are adding — it needs a sequence file, its index and a name — or clear it before opening.',
        )
      }
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
      fullWidth
      maxWidth="lg"
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
          loading={loading}
          // editing the form is the user acting on whatever the last error
          // said, so the message goes as soon as they do — it otherwise sits
          // under a form they have already fixed
          setForm={update => {
            setError(undefined)
            setForm(update)
          }}
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
