import { useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  ImportFormModeToggle,
  QuickStartPanel,
  allSessionTracks,
  useQuickStartState,
} from '@jbrowse/synteny-core'
import { Container, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import ImportSyntenyTrackSelectorArea from './ImportSyntenyTrackSelectorArea.tsx'
import LeftPanel from './LeftPanel.tsx'
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
  // inline-block so the row list hugs its contents rather than spanning the
  // form, which keeps it a meaningful thing to point at
  rows: {
    display: 'inline-block',
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
    const quick = useQuickStartState(allSessionTracks(session))
    const [selectedRow, setSelectedRow] = useState(0)
    // Two different assemblies, so Manual doesn't open on a same-assembly pair
    // (which needs a self-alignment track and so is flagged). There is no point
    // consulting connectivity here: any synteny track opens the form in Quick
    // start instead, and reaching Manual from there hands over that track's rows.
    const [selectedAssemblyNames, setSelectedAssemblyNames] = useState(() => {
      const first = assemblyNames[0] ?? ''
      return [first, assemblyNames[1] ?? first]
    })

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

    // the model owns the error: setViews clears it, so a re-submit after a bad
    // init supersedes the old banner without a second copy of the state here. A
    // failed `init` also lands the view on this form rather than a spinner (see
    // showImportForm), and the banner is what explains why.
    const launch = (rows: string[]) => {
      try {
        doSubmit({ selectedAssemblyNames: rows, model, session })
      } catch (e) {
        console.error(e)
        model.setError(e)
      }
    }

    return (
      <Container
        className={classes.importFormContainer}
        data-testid="import-form"
      >
        {model.error ? <ErrorBanner error={model.error} /> : null}
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
          <QuickStartPanel
            model={model}
            tracks={quick.quickTracks}
            trackId={quick.trackId}
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
            swapTitle="Reverse the row order (flips the stack top to bottom)"
          >
            {/* the rows the chosen track implies, shown where the picker is
            rather than written into a form elsewhere on the page. A synteny
            track is queryable in either direction, so the order it implies is a
            starting point the user can flip, not a property of the track. */}
            <div data-testid="quick-start-rows" className={classes.rows}>
              <Typography variant="body2" color="text.secondary">
                Opens {quick.rows.length} rows, top to bottom:
              </Typography>
              {quick.rows.map((row, idx) => (
                // eslint-disable-next-line @eslint-react/no-array-index-key -- row position is the identity here; assembly names can repeat across rows
                <Typography key={`${row}-${idx}`} variant="body2">
                  {idx + 1}. {row}
                </Typography>
              ))}
            </div>
          </QuickStartPanel>
        ) : (
          <div className={classes.flex}>
            <div className={classes.leftPanel}>
              <LeftPanel
                model={model}
                selectedAssemblyNames={selectedAssemblyNames}
                setSelectedAssemblyNames={setSelectedAssemblyNames}
                selectedRow={selectedRow}
                setSelectedRow={setSelectedRow}
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
