import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import AssemblySelector from '@jbrowse/core/ui/AssemblySelector'
import {
  Button,
  CircularProgress,
  Container,
  Grid,
  Typography,
  makeStyles,
} from '@material-ui/core'
// other
import RefNameAutocomplete from './RefNameAutocomplete'
import SearchResultsDialog from './SearchResultsDialog'
import { LinearGenomeViewModel } from '..'
import { dedupe } from './util'

const useStyles = makeStyles(theme => ({
  importFormContainer: {
    padding: theme.spacing(2),
  },
  button: {
    margin: theme.spacing(2),
  },
}))

type LGV = LinearGenomeViewModel

const ErrorDisplay = observer(({ error }: { error?: Error | string }) => {
  return (
    <Typography variant="h6" color="error">
      {`${error}`}
    </Typography>
  )
})

const ImportForm = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const session = getSession(model)
  const { assemblyNames, assemblyManager, textSearchManager } = session
  const {
    rankSearchResults,
    isSearchDialogDisplayed,
    error: modelError,
  } = model
  const [selectedAsm, setSelectedAsm] = useState(assemblyNames[0])
  const [error, setError] = useState<typeof modelError | undefined>(modelError)
  const message = !assemblyNames.length ? 'No configured assemblies' : ''
  const searchScope = model.searchScope(selectedAsm)

  const assembly = assemblyManager.get(selectedAsm)
  const assemblyError = assemblyNames.length
    ? assembly?.error
    : 'No configured assemblies'
  const regions = assembly?.regions || []
  const err = assemblyError || error
  const [mySelectedRegion, setSelectedRegion] = useState<string>()
  const [optionTrackId, setOptionTrackId] = useState<string>()
  const [optionLocation, setOptionLocation] = useState<string>()
  const selectedRegion = mySelectedRegion || regions[0]?.refName

  async function fetchResults(queryString: string) {
    if (!textSearchManager) {
      console.warn('No text search manager')
    }
    const results = await textSearchManager?.search(
      {
        queryString: queryString.toLowerCase(),
        searchType: 'exact',
      },
      searchScope,
      rankSearchResults,
    )

    return dedupe(results)
  }

  /**
   * gets a string as input, or use stored option results from previous query,
   * then re-query and
   * 1) if it has multiple results: pop a dialog
   * 2) if it's a single result navigate to it
   * 3) else assume it's a locstring and navigate to it
   */
  async function handleSelectedRegion(input: string) {
    let trackId = optionTrackId
    let location = input || optionLocation || ''
    try {
      const results = await fetchResults(input)
      if (results && results.length > 1) {
        model.setSearchResults(results, input.toLowerCase())
        return
      } else if (results?.length === 1) {
        location = results[0].getLocation()
        trackId = results[0].getTrackId()
      }

      model.navToLocString(location, selectedAsm)
      if (trackId) {
        model.showTrack(trackId)
      }
    } catch (e) {
      console.error(e)
      session.notify(`${e}`, 'warning')
    }
  }

  // implementation notes:
  // having this wrapped in a form allows intuitive use of enter key to submit
  return (
    <div>
      {err ? <ErrorDisplay error={err} /> : null}
      <Container className={classes.importFormContainer}>
        <form
          onSubmit={event => {
            event.preventDefault()
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
                  setError(undefined)
                  setSelectedAsm(val)
                }}
                session={session}
                selected={selectedAsm}
              />
            </Grid>
            <Grid item>
              {selectedAsm ? (
                err ? (
                  <Typography color="error">X</Typography>
                ) : selectedRegion && model.volatileWidth ? (
                  <RefNameAutocomplete
                    model={model}
                    assemblyName={message ? undefined : selectedAsm}
                    value={selectedRegion}
                    onSelect={option => {
                      setSelectedRegion(option.getDisplayString())
                      setOptionTrackId(option.getTrackId() || '')
                      setOptionLocation(option.getLocation())
                    }}
                    TextFieldProps={{
                      margin: 'normal',
                      variant: 'outlined',
                      helperText: 'Enter a sequence or location',
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
                disabled={!selectedRegion}
                className={classes.button}
                onClick={() => {
                  model.setError(undefined)
                  if (selectedRegion) {
                    handleSelectedRegion(selectedRegion)
                  }
                }}
                variant="contained"
                color="primary"
              >
                Open
              </Button>
              <Button
                disabled={!selectedRegion}
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
          handleClose={() => {
            model.setSearchResults(undefined, undefined)
          }}
        />
      ) : null}
    </div>
  )
})

export default ImportForm
