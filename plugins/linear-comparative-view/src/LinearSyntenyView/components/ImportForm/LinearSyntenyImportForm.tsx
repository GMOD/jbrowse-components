import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  ImportFormModeToggle,
  quickStartSyntenyTracks,
  syntenyTrackRows,
} from '@jbrowse/synteny-core'
import { Container } from '@mui/material'
import { observer } from 'mobx-react'

import ImportSyntenyTrackSelector from './ImportSyntenyTrackSelectorArea.tsx'
import LeftPanel from './LeftPanel.tsx'
import QuickStart from './QuickStart.tsx'
import { doSubmit } from './doSubmit.tsx'

import type { LinearSyntenyViewModel } from '../../model.ts'
import type { ImportFormMode } from '@jbrowse/synteny-core'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
  },
  flex: {
    display: 'flex',
    gap: 90,
  },
  rightPanel: {
    flexGrow: 11,
  },
  leftPanel: {
    flexGrow: 4,
    flexShrink: 0,
  },
  toggle: {
    marginBottom: theme.spacing(2),
  },
}))

const LinearSyntenyViewImportForm = observer(
  function LinearSyntenyViewImportForm({
    model,
  }: {
    model: LinearSyntenyViewModel
  }) {
    const { classes } = useStyles()
    const session = getSession(model)
    const { assemblyNames } = session
    const defaultAssemblyName = assemblyNames[0] ?? ''
    const quickTracks = quickStartSyntenyTracks(session.tracks)
    const [mode, setMode] = useState<ImportFormMode>(
      quickTracks.length ? 'quick' : 'manual',
    )
    const [quickTrackId, setQuickTrackId] = useState(
      quickTracks[0]?.trackId ?? '',
    )
    const [selectedRow, setSelectedRow] = useState(0)
    const [selectedAssemblyNames, setSelectedAssemblyNames] = useState([
      defaultAssemblyName,
      defaultAssemblyName,
    ])
    const [error, setError] = useState<unknown>()
    const [submitting, setSubmitting] = useState(false)

    const quickTrack = quickTracks.find(t => t.trackId === quickTrackId)
    const quickRows = quickTrack ? syntenyTrackRows(quickTrack) : []

    // the chosen track backs every adjacent band: a pairwise track has one pair,
    // an all-vs-all track has one per adjacent row
    function applyQuickSelections(rows: string[], trackId: string) {
      model.clearImportFormSyntenyTracks()
      for (let idx = 0; idx < rows.length - 1; idx++) {
        model.setImportFormSyntenyTrack(idx, {
          type: 'preConfigured',
          value: trackId,
        })
      }
    }

    const launch = async (rows: string[]) => {
      try {
        setError(undefined)
        setSubmitting(true)
        await doSubmit({
          selectedAssemblyNames: rows,
          model,
        })
      } catch (e) {
        console.error(e)
        setError(e)
        setSubmitting(false)
      }
    }

    return (
      <Container className={classes.importFormContainer} data-testid="import-form">
        {error ? <ErrorBanner error={error} /> : null}
        <div className={classes.toggle}>
          <ImportFormModeToggle
            mode={mode}
            onChange={newMode => {
              // switching to Manual hands over what Quick start had set up, so
              // the rows open on the chosen track instead of resetting
              if (newMode === 'manual' && quickTrack) {
                setSelectedAssemblyNames(quickRows)
                setSelectedRow(0)
                applyQuickSelections(quickRows, quickTrackId)
              }
              setMode(newMode)
            }}
          />
        </div>
        {mode === 'quick' ? (
          <QuickStart
            model={model}
            tracks={quickTracks}
            trackId={quickTrackId}
            rows={quickRows}
            submitting={submitting}
            onChange={setQuickTrackId}
            onLaunch={() => {
              applyQuickSelections(quickRows, quickTrackId)
              void launch(quickRows)
            }}
          />
        ) : (
          <div className={classes.flex}>
            <div className={classes.leftPanel}>
              <LeftPanel
                model={model}
                selectedAssemblyNames={selectedAssemblyNames}
                setSelectedAssemblyNames={setSelectedAssemblyNames}
                selectedRow={selectedRow}
                setSelectedRow={setSelectedRow}
                defaultAssemblyName={defaultAssemblyName}
                submitting={submitting}
                onLaunch={() => {
                  void launch(selectedAssemblyNames)
                }}
              />
            </div>
            <div className={classes.rightPanel}>
              <div role="status" aria-live="polite">
                Synteny dataset to display between row {selectedRow + 1} and{' '}
                {selectedRow + 2}
              </div>
              <ImportSyntenyTrackSelector
                key={`${selectedRow}-${selectedAssemblyNames[selectedRow]}-${selectedAssemblyNames[selectedRow + 1]}`}
                model={model}
                selectedRow={selectedRow}
                assembly1={selectedAssemblyNames[selectedRow]!}
                assembly2={selectedAssemblyNames[selectedRow + 1]!}
              />
            </div>
          </div>
        )}
      </Container>
    )
  },
)

export default LinearSyntenyViewImportForm
