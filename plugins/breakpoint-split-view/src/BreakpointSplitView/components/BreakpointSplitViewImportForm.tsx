import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Container, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import ImportFormRow from './ImportFormRow.tsx'
import SharedTrackSelector from './SharedTrackSelector.tsx'
import { rowsToViewInits, swap } from './importFormUtils.ts'

import type { ImportFormRowData } from './importFormUtils.ts'
import type { BreakpointViewModel } from '../model.ts'

const useStyles = makeStyles()(theme => ({
  container: {
    padding: theme.spacing(4),
  },
  section: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  button: {
    margin: theme.spacing(1),
  },
}))

const BreakpointSplitViewImportForm = observer(
  function BreakpointSplitViewImportForm({
    model,
  }: {
    model: BreakpointViewModel
  }) {
    const { classes } = useStyles()
    const session = getSession(model)
    const defaultAssembly = session.assemblyNames[0] ?? ''
    const [rows, setRows] = useState<ImportFormRowData[]>([
      { assembly: defaultAssembly, loc: '' },
      { assembly: defaultAssembly, loc: '' },
    ])
    const [trackId, setTrackId] = useState('')
    const [error, setError] = useState<unknown>()
    const canLaunch = rows.every(r => r.assembly)

    function patchRow(idx: number, patch: Partial<ImportFormRowData>) {
      setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
    }

    return (
      <Container className={classes.container}>
        {error ? <ErrorBanner error={error} /> : null}
        <Typography variant="h6">
          Open a breakpoint split view comparing two or more regions
        </Typography>
        <div className={classes.section}>
          {rows.map((row, idx) => (
            <ImportFormRow
              key={idx}
              idx={idx}
              count={rows.length}
              assembly={row.assembly}
              loc={row.loc}
              session={session}
              onAssemblyChange={val => {
                patchRow(idx, { assembly: val })
                setTrackId('')
              }}
              onLocChange={val => {
                patchRow(idx, { loc: val })
              }}
              onRemove={() => {
                setRows(rows.filter((_, i) => i !== idx))
              }}
              onMove={delta => {
                setRows(swap(rows, idx, idx + delta))
              }}
            />
          ))}
        </div>

        <div className={classes.section}>
          <SharedTrackSelector
            model={model}
            assemblies={rows.map(r => r.assembly)}
            value={trackId}
            onChange={val => {
              setTrackId(val)
            }}
          />
        </div>

        <div>
          <Button
            className={classes.button}
            variant="outlined"
            onClick={() => {
              setRows([...rows, { assembly: defaultAssembly, loc: '' }])
            }}
          >
            Add row
          </Button>
          <Button
            className={classes.button}
            variant="contained"
            color="primary"
            disabled={!canLaunch}
            onClick={() => {
              try {
                setError(undefined)
                model.setViews(rowsToViewInits(rows, trackId))
              } catch (e) {
                console.error(e)
                setError(e)
              }
            }}
          >
            Open
          </Button>
        </div>
      </Container>
    )
  },
)

export default BreakpointSplitViewImportForm
