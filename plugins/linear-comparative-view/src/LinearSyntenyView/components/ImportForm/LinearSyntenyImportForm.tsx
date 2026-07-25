import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { ImportFormModeToggle, useQuickStartState } from '@jbrowse/synteny-core'
import { Container } from '@mui/material'
import { observer } from 'mobx-react'

import ImportSyntenyTrackSelectorArea from './ImportSyntenyTrackSelectorArea.tsx'
import LeftPanel from './LeftPanel.tsx'
import QuickStart from './QuickStart.tsx'
import { doSubmit } from './doSubmit.tsx'

import type { LinearSyntenyViewModel } from '../../model.ts'

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
    const quick = useQuickStartState(session.tracks)
    const [selectedRow, setSelectedRow] = useState(0)
    const [selectedAssemblyNames, setSelectedAssemblyNames] = useState([
      defaultAssemblyName,
      secondAssemblyName,
    ])
    const [error, setError] = useState<unknown>()

    // the chosen track backs every adjacent band: a pairwise track has one pair,
    // an all-vs-all track has one per adjacent row
    function applyQuickSelections() {
      model.clearImportFormSyntenyTracks()
      for (let idx = 0; idx < quick.rows.length - 1; idx++) {
        model.setImportFormSyntenyTrack(idx, {
          type: 'preConfigured',
          value: quick.trackId,
        })
      }
    }

    const launch = (rows: string[]) => {
      try {
        setError(undefined)
        doSubmit({
          selectedAssemblyNames: rows,
          model,
        })
      } catch (e) {
        console.error(e)
        setError(e)
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
            mode={quick.mode}
            onChange={newMode => {
              // switching to Manual hands over what Quick start had set up, so
              // the rows open on the chosen track instead of resetting
              if (newMode === 'manual' && quick.track) {
                setSelectedAssemblyNames(quick.rows)
                setSelectedRow(0)
                applyQuickSelections()
              }
              quick.setMode(newMode)
            }}
          />
        </div>
        {quick.mode === 'quick' ? (
          <QuickStart
            model={model}
            tracks={quick.quickTracks}
            trackId={quick.trackId}
            rows={quick.rows}
            onChange={newTrackId => {
              quick.setTrackId(newTrackId)
            }}
            onSwap={() => {
              quick.swap()
            }}
            onLaunch={() => {
              applyQuickSelections()
              launch(quick.rows)
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
                onLaunch={() => {
                  launch(selectedAssemblyNames)
                }}
              />
            </div>
            <div className={classes.rightPanel}>
              <div role="status" aria-live="polite">
                Synteny dataset to display between row {selectedRow + 1} and{' '}
                {selectedRow + 2}
              </div>
              {/* the selector area holds local radio-choice state per pair, so
              it remounts whenever the pair being configured changes — this key
              is the only thing resetting it */}
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
