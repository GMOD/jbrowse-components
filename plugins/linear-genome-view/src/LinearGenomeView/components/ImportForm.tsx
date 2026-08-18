import { useState } from 'react'

import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import {
  AssemblySelector,
  ErrorBanner,
  RefNameAutocomplete,
  RefNameAutocompleteEndAdornment,
  adornmentReservePx,
  useAssemblySelection,
  useRecentLocations,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import { Button, CircularProgress, Container, Grid } from '@mui/material'
import { observer } from 'mobx-react'

import {
  fetchResults,
  navigateToSelectedOption,
  notifySearchFailure,
} from '../../searchUtils.ts'
import { recentLocationOf, recentLocationsMenu } from './recentLocationsMenu.ts'

import type { LinearGenomeViewModel } from '../index.ts'

const useStyles = makeStyles()(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
  },
  button: {
    margin: theme.spacing(2),
  },
}))

const LinearGenomeViewImportForm = observer(
  function LinearGenomeViewImportForm({
    model,
  }: {
    model: LinearGenomeViewModel
  }) {
    const { classes } = useStyles()
    const session = getSession(model)
    const { textSearchManager } = session
    const { error: viewError } = model
    const {
      selectedAssemblyName: selectedAsm,
      setSelectedAssemblyName,
      assembly,
      assemblyError,
      regions,
    } = useAssemblySelection(session, 'lgv')
    const { recentLocations, addRecentLocation, clearRecentLocations } =
      useRecentLocations(selectedAsm)

    // The location the form will open, tagged with the assembly it was entered
    // for, and read back only while that tag still matches. Switching assembly
    // then drops it structurally — nothing has to remember to clear it — which
    // is the shape `useAssemblySelection` already uses for the assembly choice
    // itself ("stored as an override, re-resolved against the live list every
    // render") and the breakpoint form uses for its shared track. One object
    // rather than a text/option pair for the same reason: they are only ever
    // valid together, and as two useStates every write had to remember to reset
    // the other.
    //
    // Undefined means "nothing entered yet", which is what makes the box fall
    // back to the first refname below and keeps that default out of the recent
    // locations list.
    const [entered, setEntered] = useState<{
      assemblyName: string
      text: string
      option?: BaseResult
    }>()
    const current = entered?.assemblyName === selectedAsm ? entered : undefined

    const value = current?.text ?? regions?.[0]?.refName ?? ''
    const displayError = assemblyError ?? viewError

    async function navigate({
      option,
      record,
    }: {
      option: BaseResult
      // only remember locations the user actually typed or picked; skip the
      // default first-refname that pre-fills the box, so a plain "Open" of the
      // starting chromosome doesn't clutter the recent list
      record: boolean
    }) {
      model.setError(undefined)
      if (selectedAsm) {
        try {
          await navigateToSelectedOption({
            option,
            model,
            assemblyName: selectedAsm,
          })
          if (record) {
            addRecentLocation(recentLocationOf(option))
          }
        } catch (e) {
          notifySearchFailure(session, e)
        }
      }
    }

    const recentMenuItems = recentLocationsMenu({
      recentLocations,
      onNavigate: option => {
        navigate({ option, record: true }).catch(() => {})
      },
      onClear: clearRecentLocations,
    })

    return (
      <Container
        className={classes.importFormContainer}
        data-testid="import-form"
      >
        {displayError ? <ErrorBanner error={displayError} /> : null}
        <form
          onSubmit={async event => {
            event.preventDefault()
            if (value) {
              await navigate({
                option: current?.option ?? new BaseResult({ label: value }),
                record: current !== undefined,
              })
            }
          }}
        >
          <Grid
            container
            spacing={1}
            sx={{ justifyContent: 'center', alignItems: 'center' }}
          >
            <AssemblySelector
              onChange={val => {
                // Only the model's error needs clearing by hand: it lives
                // outside React and is not tagged with the assembly it was
                // about. The typed location isn't reset here — `entered` is
                // tagged, so it drops itself. The banner reports the previous
                // assembly's failure (that is why the form is up at all), so it
                // has to go with it; the circular form clears here for the same
                // reason.
                model.setError(undefined)
                setSelectedAssemblyName(val)
              }}
              session={session}
              selected={selectedAsm}
            />
            {selectedAsm ? (
              assemblyError ? (
                <CloseIcon color="error" />
              ) : regions ? (
                <RefNameAutocomplete
                  fetchResults={(queryString, stopToken) =>
                    fetchResults({
                      queryString,
                      assembly,
                      textSearchManager,
                      assemblyName: selectedAsm,
                      stopToken,
                    })
                  }
                  session={session}
                  assemblyName={selectedAsm}
                  value={value}
                  minWidth={270}
                  adornmentWidth={adornmentReservePx({
                    menuItemCount: recentMenuItems.length,
                  })}
                  onChange={v => {
                    // no `option` on the new object, so typing over a picked
                    // search result discards it rather than opening the old
                    // one's location under the new text
                    setEntered({ assemblyName: selectedAsm, text: v })
                  }}
                  onSelect={opt => {
                    setEntered({
                      assemblyName: selectedAsm,
                      text: opt.getDisplayString(),
                      option: opt,
                    })
                  }}
                  endAdornment={
                    <RefNameAutocompleteEndAdornment
                      menuItems={recentMenuItems}
                    />
                  }
                  helperText="Enter sequence name, feature name, or location"
                />
              ) : (
                <CircularProgress size={20} disableShrink />
              )
            ) : null}
            <Button
              type="submit"
              disabled={!value}
              className={classes.button}
              variant="contained"
              color="primary"
            >
              Open
            </Button>
            <Button
              disabled={!!assemblyError || !regions}
              className={classes.button}
              onClick={() => {
                model.setError(undefined)
                model.showAllRegionsInAssembly(selectedAsm)
              }}
              variant="contained"
              color="secondary"
            >
              Show all regions in assembly
            </Button>
          </Grid>
        </form>
      </Container>
    )
  },
)

export default LinearGenomeViewImportForm
