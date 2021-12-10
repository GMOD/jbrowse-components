import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import {
  Button,
  CircularProgress,
  Container,
  Grid,
  Typography,
  makeStyles,
} from '@material-ui/core'
import { SearchType } from '@jbrowse/core/data_adapters/BaseAdapter'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import AssemblySelector from '@jbrowse/core/ui/AssemblySelector'

// locals
import RefNameAutocomplete from './RefNameAutocomplete'
import SearchResultsDialog from './SearchResultsDialog'
import { LinearGenomeViewModel } from '..'

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
  const searchScope = model.searchScope(selectedAsm)

  const assembly = assemblyManager.get(selectedAsm)
  const assemblyError = assemblyNames.length
    ? assembly?.error
    : 'No configured assemblies'
  const regions = assembly?.regions || []
  const err = assemblyError || error

  const [myOption, setOption] = useState<BaseResult>()

  // use this instead of useState initializer because the useState initializer
  // won't update in response to an observable
  const option =
    myOption ||
    new BaseResult({
      label: regions[0]?.refName,
    })

  const selectedRegion = option?.getLocation()

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

  /**
   * gets a string as input, or use stored option results from previous query,
   * then re-query and
   * 1) if it has multiple results: pop a dialog
   * 2) if it's a single result navigate to it
   * 3) else assume it's a locstring and navigate to it
   */
  async function handleSelectedRegion(input: string) {
    if (!option) {
      return
    }
    let trackId = option.getTrackId()
    let location = input || option.getLocation() || ''
    try {
      if (assembly?.allRefNames?.includes(location)) {
        model.navToLocString(location, selectedAsm)
      } else {
        const results = await fetchResults(input, 'exact')
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
                    fetchResults={fetchResults}
                    model={model}
                    assemblyName={assemblyError ? undefined : selectedAsm}
                    value={selectedRegion}
                    onSelect={option => setOption(option)}
                    TextFieldProps={{
                      margin: 'normal',
                      variant: 'outlined',
                      helperText:
                        'Enter sequence name, feature name, or location',
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
          handleClose={() => model.setSearchResults(undefined, undefined)}
        />
      ) : null}
    </div>
  )
})

export default ImportForm
