import { useState } from 'react'

import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import {
  AssemblySelector,
  ErrorBanner,
  RefNameAutocomplete,
  RefNameAutocompleteEndAdornment,
  useAssemblySelection,
  useRecentLocations,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import { Button, CircularProgress, Container, Grid } from '@mui/material'
import { observer } from 'mobx-react'

import { recentLocationsMenu } from './recentLocationsMenu.ts'
import { fetchResults, navigateToSelectedOption } from '../../searchUtils.ts'

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

    // the location the form will open; the input starts on the first refname
    // and is replaced by whatever the user types or picks
    const [selectedOption, setSelectedOption] = useState<BaseResult>()
    const [inputText, setInputText] = useState<string>()

    const value = inputText ?? regions?.[0]?.refName ?? ''
    const displayError = assemblyError ?? viewError

    async function navigate({
      loc,
      option,
      record,
    }: {
      loc: string
      option?: BaseResult
      // only remember locations the user actually typed or picked; skip the
      // default first-refname that pre-fills the box, so a plain "Open" of the
      // starting chromosome doesn't clutter the recent list
      record: boolean
    }) {
      model.setError(undefined)
      if (loc && selectedAsm) {
        try {
          await navigateToSelectedOption({
            option: option ?? new BaseResult({ label: loc }),
            model,
            assemblyName: selectedAsm,
          })
          if (record) {
            addRecentLocation(loc)
          }
        } catch (e) {
          console.error(e)
          session.notify(`${e}`, 'warning')
        }
      }
    }

    const recentMenuItems = recentLocationsMenu({
      recentLocations,
      onNavigate: loc => {
        navigate({ loc, record: true }).catch(() => {})
      },
      onClear: clearRecentLocations,
    })

    return (
      <Container className={classes.importFormContainer}>
        {displayError ? <ErrorBanner error={displayError} /> : null}
        <form
          onSubmit={async event => {
            event.preventDefault()
            await navigate({
              loc: value,
              option: selectedOption,
              record: inputText !== undefined,
            })
          }}
        >
          <Grid
            container
            spacing={1}
            sx={{ justifyContent: 'center', alignItems: 'center' }}
          >
            <AssemblySelector
              onChange={val => {
                setSelectedAssemblyName(val)
                setInputText(undefined)
                setSelectedOption(undefined)
              }}
              session={session}
              selected={selectedAsm}
            />
            {selectedAsm ? (
              assemblyError ? (
                <CloseIcon color="error" />
              ) : regions ? (
                <RefNameAutocomplete
                  fetchResults={queryString =>
                    fetchResults({
                      queryString,
                      assembly,
                      textSearchManager,
                      searchScope: model.searchScope(selectedAsm),
                    })
                  }
                  session={session}
                  assemblyName={selectedAsm}
                  value={value}
                  minWidth={270}
                  onChange={v => {
                    setInputText(v)
                    setSelectedOption(undefined)
                  }}
                  onSelect={opt => {
                    setSelectedOption(opt)
                    setInputText(opt.getDisplayString())
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
