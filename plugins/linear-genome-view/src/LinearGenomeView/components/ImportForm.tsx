import React, { useState, lazy } from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import { Button, CircularProgress, Container, Grid, Theme } from '@mui/material'
import { SearchType } from '@jbrowse/core/data_adapters/BaseAdapter'
import { ErrorMessage, AssemblySelector } from '@jbrowse/core/ui'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import CloseIcon from '@mui/icons-material/Close'

// locals
import RefNameAutocomplete from './RefNameAutocomplete'
import { LinearGenomeViewModel, WIDGET_HEIGHT } from '..'
const SearchResultsDialog = lazy(() => import('./SearchResultsDialog'))

const useStyles = makeStyles()((theme: Theme) => ({
  importFormContainer: {
    padding: theme.spacing(2),
  },
  button: {
    margin: theme.spacing(2),
  },
  container: {
    padding: theme.spacing(4),
  },
}))

type LGV = LinearGenomeViewModel

const ImportForm = observer(({ model }: { model: LGV }) => {
  const { classes } = useStyles()
  const session = getSession(model)
  const { assemblyNames, assemblyManager, textSearchManager } = session
  const { rankSearchResults, isSearchDialogDisplayed, error } = model
  const [selectedAsm, setSelectedAsm] = useState(assemblyNames[0])
  const [importError, setImportError] = useState(error)
  const searchScope = model.searchScope(selectedAsm)

  const assembly = assemblyManager.get(selectedAsm)
  const assemblyError = assemblyNames.length
    ? assembly?.error
    : 'No configured assemblies'
  const regions = assembly?.regions || []
  const err = assemblyError || importError
  const [myVal, setValue] = useState('')
  const value = myVal || regions[0]?.refName

  // use this instead of useState initializer because the useState initializer
  // won't update in response to an observable
  const option = new BaseResult({
    label: value,
  })

  async function fetchResults(query: string, searchType?: SearchType) {
    if (!textSearchManager) {
      console.warn('No text search manager')
    }

    const textSearchResults = await textSearchManager?.search(
      {
        queryString: query,
        searchType,
      },
      searchScope,
      rankSearchResults,
    )

    const refNameResults = assembly?.allRefNames
      ?.filter(refName => refName.startsWith(query))
      .map(r => new BaseResult({ label: r }))
      .slice(0, 10)

    return [...(refNameResults || []), ...(textSearchResults || [])]
  }

  // gets a string as input, or use stored option results from previous query,
  // then re-query and
  // 1) if it has multiple results: pop a dialog
  // 2) if it's a single result navigate to it
  // 3) else assume it's a locstring and navigate to it
  async function handleSelectedRegion(input: string) {
    if (!option) {
      return
    }
    let trackId = option.getTrackId()
    let location = input || option.getLocation() || ''
    const [ref, rest] = location.split(':')
    const allRefs = assembly?.allRefNames || []
    try {
      // instead of querying text-index, first:
      // - check if input matches a refname directly
      // - or looks like locstring
      // then just navigate as if it were a locstring
      if (
        allRefs.includes(location) ||
        (allRefs.includes(ref) &&
          rest !== undefined &&
          !Number.isNaN(parseInt(rest, 10)))
      ) {
        model.navToLocString(location, selectedAsm)
      } else {
        const results = await fetchResults(input, 'exact')
        if (results.length > 1) {
          model.setSearchResults(results, input.toLowerCase())
          return
        } else if (results.length === 1) {
          location = results[0].getLocation()
          trackId = results[0].getTrackId()
        }

        model.navToLocString(location, selectedAsm)
        if (trackId) {
          model.showTrack(trackId)
        }
      }
    } catch (e) {
      console.error(e)
      session.notify(`${e}`, 'warning')
    }
  }

  const height = WIDGET_HEIGHT + 5

  // implementation notes:
  // having this wrapped in a form allows intuitive use of enter key to submit
  return (
    <div className={classes.container}>
      {err ? <ErrorMessage error={err} /> : null}
      <Container className={classes.importFormContainer}>
        <form
          onSubmit={event => {
            event.preventDefault()
            model.setError(undefined)
            if (value) {
              handleSelectedRegion(value)
            }
          }}
        >
          <Grid
            container
            spacing={1}
            justifyContent="center"
            alignItems="center"
          >
            <Grid item>
              <AssemblySelector
                onChange={val => {
                  setImportError('')
                  setSelectedAsm(val)
                }}
                session={session}
                selected={selectedAsm}
                InputProps={{ style: { height } }}
              />
            </Grid>
            <Grid item>
              {selectedAsm ? (
                err ? (
                  <CloseIcon style={{ color: 'red' }} />
                ) : value ? (
                  <RefNameAutocomplete
                    fetchResults={fetchResults}
                    model={model}
                    assemblyName={assemblyError ? undefined : selectedAsm}
                    value={value}
                    // note: minWidth 270 accomodates full width of helperText
                    minWidth={270}
                    onChange={str => setValue(str)}
                    TextFieldProps={{
                      variant: 'outlined',
                      helperText:
                        'Enter sequence name, feature name, or location',
                      style: { minWidth: '175px' },
                      InputProps: { style: { height } },
                    }}
                  />
                ) : (
                  <CircularProgress
                    role="progressbar"
                    size={20}
                    disableShrink
                  />
                )
              ) : null}
            </Grid>
            <Grid item>
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
                disabled={!value}
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
          </Grid>
        </form>
      </Container>
      {isSearchDialogDisplayed ? (
        <SearchResultsDialog
          model={model}
          optAssemblyName={selectedAsm}
          handleClose={() => model.setSearchResults(undefined, undefined)}
        />
      ) : null}
    </div>
  )
})

export default ImportForm
