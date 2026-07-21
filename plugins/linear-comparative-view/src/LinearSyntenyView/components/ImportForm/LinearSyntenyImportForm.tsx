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

import ImportSyntenyTrackSelectorArea from './ImportSyntenyTrackSelectorArea.tsx'
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
    // second row defaults to a different assembly when one exists, so Manual
    // mode doesn't open on a same-assembly pair (which is flagged as needing a
    // self-alignment track)
    const secondAssemblyName = assemblyNames[1] ?? defaultAssemblyName
    const quickTracks = quickStartSyntenyTracks(session.tracks)
    const [mode, setMode] = useState<ImportFormMode>(
      quickTracks.length ? 'quick' : 'manual',
    )
    const [quickTrackId, setQuickTrackId] = useState(
      quickTracks[0]?.trackId ?? '',
    )
    // a synteny track answers in either direction, so the row order it implies
    // is a starting point the user can flip, not a property of the track
    const [quickSwapped, setQuickSwapped] = useState(false)
    const [selectedRow, setSelectedRow] = useState(0)
    const [selectedAssemblyNames, setSelectedAssemblyNames] = useState([
      defaultAssemblyName,
      secondAssemblyName,
    ])
    const [error, setError] = useState<unknown>()
    const [submitting, setSubmitting] = useState(false)

    const quickTrack = quickTracks.find(t => t.trackId === quickTrackId)
    const trackRows = quickTrack ? syntenyTrackRows(quickTrack) : []
    const quickRows = quickSwapped ? [...trackRows].reverse() : trackRows

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
      <Container
        className={classes.importFormContainer}
        data-testid="import-form"
      >
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
            onSwap={() => {
              setQuickSwapped(!quickSwapped)
            }}
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
              <ImportSyntenyTrackSelectorArea
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
