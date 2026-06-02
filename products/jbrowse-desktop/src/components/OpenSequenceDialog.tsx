import { useState } from 'react'

import { Dialog, ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Box,
  Button,
  Chip,
  DialogActions,
  DialogContent,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import BulkForm from './BulkForm.tsx'
import GuidedForm from './GuidedForm.tsx'
import {
  clearFormFields,
  getAdapterConfig,
  getBaseAssemblyConfig,
  initialFormState,
} from './util.ts'

import type { AssemblyConf } from './util.ts'
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
  stagedAssemblies: {
    background: theme.palette.success.light,
    margin: theme.spacing(2),
    padding: theme.spacing(2),
  },
  modeToggle: {
    marginBottom: theme.spacing(1),
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
  const [mode, setMode] = useState<'guided' | 'bulk'>('guided')

  async function stageCurrentAssembly() {
    if (!form.assemblyName) {
      throw new Error('No assembly name set')
    }
    if (assemblyConfs.some(conf => conf.name === form.assemblyName)) {
      throw new Error(`Assembly "${form.assemblyName}" is already staged`)
    }
    return [...assemblyConfs, await createAssemblyConfig()]
  }

  async function addAnotherAssembly() {
    try {
      setError(undefined)
      setAssemblyConfs(await stageCurrentAssembly())
      setForm(clearFormFields)
    } catch (e) {
      setError(e)
      console.error(e)
    } finally {
      setLoading('')
    }
  }

  async function indexFasta(fastaLocation: FileLocation) {
    setLoading('Creating .fai file for FASTA')
    const faiPath = await ipcRenderer.invoke('indexFasta', fastaLocation)
    return {
      type: 'IndexedFastaAdapter' as const,
      fastaLocation,
      faiLocation: {
        localPath: faiPath,
        locationType: 'LocalPathLocation' as const,
      },
    }
  }

  async function createAssemblyConfig() {
    const result = getAdapterConfig(form)
    const adapter =
      result.kind === 'needsFastaIndex'
        ? await indexFasta(result.fastaLocation)
        : result.adapter
    return {
      ...getBaseAssemblyConfig(form),
      sequence: {
        type: 'ReferenceSequenceTrack' as const,
        trackId: `${form.assemblyName}-${Date.now()}`,
        adapter,
      },
    }
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
          <Box className={classes.stagedAssemblies}>
            <Typography variant="body2" gutterBottom>
              Staged assemblies:
            </Typography>
            {assemblyConfs.map((conf, idx) => (
              <Chip
                key={conf.name}
                label={conf.name}
                onDelete={() => {
                  setAssemblyConfs(assemblyConfs.filter((_, i) => i !== idx))
                }}
                style={{ margin: 2 }}
              />
            ))}
          </Box>
        ) : null}

        {loading ? (
          <LoadingEllipses className={classes.message} message={loading} />
        ) : null}

        {error ? <ErrorMessage error={error} /> : null}

        <Paper className={classes.paper}>
          <ToggleButtonGroup
            className={classes.modeToggle}
            size="small"
            exclusive
            value={mode}
            onChange={(_event, value: 'guided' | 'bulk' | null) => {
              if (value) {
                setMode(value)
              }
            }}
          >
            <ToggleButton value="guided">Guided</ToggleButton>
            <ToggleButton value="bulk">Drop / paste files</ToggleButton>
          </ToggleButtonGroup>

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
          onClick={async () => {
            try {
              setError(undefined)
              const confs = form.assemblyName
                ? await stageCurrentAssembly()
                : assemblyConfs
              if (!confs.length) {
                throw new Error('No assemblies specified')
              }
              setAssemblyConfs(confs)
              await onClose(confs)
            } catch (e) {
              setError(e)
              console.error(e)
            } finally {
              setLoading('')
            }
          }}
          color="primary"
          disabled={!!loading}
          variant="contained"
        >
          Open
        </Button>
      </DialogActions>
    </Dialog>
  )
})

export default OpenSequenceDialog
