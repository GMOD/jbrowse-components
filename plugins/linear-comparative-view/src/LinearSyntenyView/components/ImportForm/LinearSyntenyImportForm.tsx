import { useId, useState } from 'react'

import { ErrorBanner } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  ImportFormModes,
  allSessionTracks,
  applyQuickStartSelections,
  blockedByUnfinishedUpload,
  syntenyPairStatuses,
  useChromosomeFilters,
  useImportFormSyntenyChoices,
  useQuickStartState,
} from '@jbrowse/synteny-core'
import { Button, Container, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import ImportSyntenyTrackSelectorArea from './ImportSyntenyTrackSelectorArea.tsx'
import LeftPanel from './LeftPanel.tsx'
import { doSubmit } from './doSubmit.tsx'

import type { LinearSyntenyViewModel } from '../../model.ts'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
  },
  // wraps rather than squeezing: a synteny view is often opened in a narrow
  // panel, and the right column holds a file uploader that has nowhere to go
  flex: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(6),
  },
  rightPanel: {
    flexGrow: 11,
    flexBasis: 400,
  },
  leftPanel: {
    flexGrow: 4,
    flexShrink: 0,
  },
  // Launch sits below both columns rather than under the assembly rows: the
  // last thing configured is the track for a pair, which is in the right
  // column, and a primary action above its own last input reads as premature
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    marginTop: theme.spacing(3),
  },
  header: {
    marginBottom: theme.spacing(1),
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
    const quick = useQuickStartState(session)
    const [selectedRow, setSelectedRow] = useState(0)
    // names the per-pair heading so it is also the track radio group's label:
    // one piece of text, rather than a heading and a duplicate screen-reader
    // label that can disagree
    const pairHeadingId = useId()
    // Two different assemblies, so Manual doesn't open on a same-assembly pair
    // (which needs a self-alignment track and so is flagged). There is no point
    // consulting connectivity here: any synteny track opens the form in Quick
    // start instead, and reaching Manual from there hands over that track's rows.
    const [selectedAssemblyNames, setSelectedAssemblyNames] = useState(() => {
      const first = assemblyNames[0] ?? ''
      return [first, assemblyNames[1] ?? first]
    })
    // parallel to the rows, and kept in step by applyRows
    const chromosomes = useChromosomeFilters()
    // held here rather than in the selector area, which the key below remounts
    const choices = useImportFormSyntenyChoices(model)

    // computed once for the whole form: the row icons, the Auto-arrange offer
    // and the Launch button are three views of the same answer, and each entry
    // costs a scan of the session's tracks
    const statusByPair = syntenyPairStatuses({
      tracks: allSessionTracks(session),
      selections: model.importFormSyntenyTrackSelections,
      assemblyNames: selectedAssemblyNames,
      assemblyManager: session.assemblyManager,
    })
    const blockedPair = statusByPair.indexOf('unfinishedUpload')
    const canLaunch = !blockedByUnfinishedUpload(statusByPair)

    // one band between each pair of adjacent rows
    function applyQuickSelections() {
      applyQuickStartSelections(model, quick.trackId, quick.rows)
    }

    // the model owns the error: setViews clears it, so a re-submit after a bad
    // init supersedes the old banner without a second copy of the state here. A
    // failed `init` also lands the view on this form rather than a spinner (see
    // showImportForm), and the banner is what explains why.
    const launch = (rows: string[], regions = chromosomes.values) => {
      try {
        doSubmit({
          selectedAssemblyNames: rows,
          regionNames: regions,
          model,
          session,
        })
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
        <ImportFormModes
          model={model}
          quick={quick}
          onHandoverToManual={() => {
            // the rows open on the chosen track instead of resetting
            setSelectedAssemblyNames(quick.rows)
            // the handover brings a different set of rows, so nothing typed
            // against the old ones still applies
            chromosomes.reset()
            setSelectedRow(0)
            applyQuickSelections()
          }}
          onQuickLaunch={() => {
            applyQuickSelections()
            // empties explicitly: Quick start does not show the chromosome
            // boxes, so it must not inherit text typed into the Manual ones
            // behind it — these are the track's rows, not the ones those boxes
            // were typed against
            launch(quick.rows, [])
          }}
          swapTitle="Reverse the row order (flips the stack top to bottom)"
          quickSummary={
            /* the rows the chosen track implies, shown where the picker is
            rather than written into a form elsewhere on the page. A synteny
            track is queryable in either direction, so the order it implies is a
            starting point the user can flip, not a property of the track. */
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
          }
        >
          <div className={classes.flex}>
            <div className={classes.leftPanel}>
              <LeftPanel
                model={model}
                statusByPair={statusByPair}
                selectedAssemblyNames={selectedAssemblyNames}
                setSelectedAssemblyNames={setSelectedAssemblyNames}
                chromosomes={chromosomes}
                selectedRow={selectedRow}
                setSelectedRow={setSelectedRow}
              />
            </div>
            <div className={classes.rightPanel}>
              {/* names the assemblies, not just the row numbers: with five
                similarly-named rows on screen the numbers alone make the user
                count. aria-live so switching pairs is announced, and the id is
                what labels the radio group below it. */}
              <Typography
                id={pairHeadingId}
                className={classes.header}
                role="status"
                aria-live="polite"
              >
                Synteny dataset between {selectedAssemblyNames[selectedRow]} and{' '}
                {selectedAssemblyNames[selectedRow + 1]} (rows {selectedRow + 1}{' '}
                and {selectedRow + 2})
              </Typography>
              {/* the uploader and any plugin body below hold local state that
                belongs to one pair, so the area remounts whenever the pair being
                configured changes. This key is the only thing resetting them —
                and the radio choice is deliberately NOT among them, which is why
                `choices` lives in this form. */}
              <ImportSyntenyTrackSelectorArea
                key={`${selectedRow}-${selectedAssemblyNames[selectedRow]}-${selectedAssemblyNames[selectedRow + 1]}`}
                model={model}
                selectedRow={selectedRow}
                labelledBy={pairHeadingId}
                choices={choices}
                assembly1={selectedAssemblyNames[selectedRow]!}
                assembly2={selectedAssemblyNames[selectedRow + 1]!}
              />
            </div>
          </div>
          <div className={classes.footer}>
            <Button
              disabled={!canLaunch}
              onClick={() => {
                launch(selectedAssemblyNames)
              }}
              variant="contained"
              color="primary"
            >
              Launch
            </Button>
            {/* why the button is off, in text next to it. The row's warning
                icon says which pair, but it is at the far edge of the other
                column and only speaks on hover. */}
            {canLaunch ? null : (
              <Typography variant="body2" color="warning.main">
                Rows {blockedPair + 1} and {blockedPair + 2} have an unfinished
                new synteny track. Finish the upload, or set that pair to None.
              </Typography>
            )}
          </div>
        </ImportFormModes>
      </Container>
    )
  },
)

export default LinearSyntenyViewImportForm
