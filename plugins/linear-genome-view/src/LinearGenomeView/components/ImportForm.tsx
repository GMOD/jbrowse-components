import React, { useState, useEffect, lazy } from 'react'
import { makeStyles } from 'tss-react/mui'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
import {
  Button,
  CircularProgress,
  FormControl,
  Container,
  Grid,
} from '@mui/material'
import { ErrorMessage, AssemblySelector } from '@jbrowse/core/ui'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

// icons
import CloseIcon from '@mui/icons-material/Close'

// locals
import RefNameAutocomplete from './RefNameAutocomplete'
import { fetchResults, splitLast } from './util'
import { LinearGenomeViewModel } from '..'
const SearchResultsDialog = lazy(() => import('./SearchResultsDialog'))

const useStyles = makeStyles()(theme => ({
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
  const [option, setOption] = useState<BaseResult>()

  const searchScope = model.searchScope(selectedAsm)

  const assembly = assemblyManager.get(selectedAsm)
  const assemblyError = assemblyNames.length
    ? assembly?.error
    : 'No configured assemblies'
  const regions = assembly?.regions || []
  const displayError = assemblyError || error
  const [value, setValue] = useState('')
  const r0 = regions[0]?.refName

  // useEffect resets to an "initial state" of displaying first region from assembly
  // after assembly change. needs to react to selectedAsm as well as r0 because changing
  // assembly will run setValue('') and then r0 may not change if assembly names are the
  // same across assemblies, but it still needs to be reset
  useEffect(() => {
    setValue(r0)
  }, [r0, selectedAsm])

  function navToOption(option: BaseResult) {
    const location = option.getLocation()
    const trackId = option.getTrackId()
    if (location) {
      model.navToLocString(location, selectedAsm)
      if (trackId) {
        model.showTrack(trackId)
      }
    }
  }

  // gets a string as input, or use stored option results from previous query,
  // then re-query and
  // 1) if it has multiple results: pop a dialog
  // 2) if it's a single result navigate to it
  // 3) else assume it's a locstring and navigate to it
  async function handleSelectedRegion(input: string) {
    try {
      if (option?.getDisplayString() === input && option.hasLocation()) {
        navToOption(option)
      } else {
        const [ref, rest] = splitLast(input, ':')
        const allRefs = assembly?.allRefNamesWithLowerCase || []
        if (
          allRefs.includes(input) ||
          (allRefs.includes(ref) && !Number.isNaN(parseInt(rest, 10)))
        ) {
          model.navToLocString(input, selectedAsm)
        } else {
          const results = await fetchResults({
            queryString: input,
            searchType: 'exact',
            searchScope,
            rankSearchResults,
            textSearchManager,
            assembly,
          })

          if (results.length > 1) {
            model.setSearchResults(results, input.toLowerCase())
          } else if (results.length === 1) {
            navToOption(results[0])
          } else {
            model.navToLocString(input, selectedAsm)
          }
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
    <div className={classes.container}>
      {displayError ? <ErrorMessage error={displayError} /> : null}
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
              <FormControl>
                <AssemblySelector
                  onChange={val => {
                    setSelectedAsm(val)
                    setValue('')
                  }}
                  session={session}
                  selected={selectedAsm}
                />
              </FormControl>
            </Grid>
            <Grid item>
              {selectedAsm ? (
                assemblyError ? (
                  <CloseIcon style={{ color: 'red' }} />
                ) : value ? (
                  <FormControl>
                    <RefNameAutocomplete
                      fetchResults={queryString =>
                        fetchResults({
                          queryString,
                          assembly,
                          textSearchManager,
                          rankSearchResults,
                          searchScope,
                        })
                      }
                      model={model}
                      assemblyName={assemblyError ? undefined : selectedAsm}
                      value={value}
                      // note: minWidth 270 accomodates full width of helperText
                      minWidth={270}
                      onChange={str => setValue(str)}
                      onSelect={val => setOption(val)}
                      TextFieldProps={{
                        variant: 'outlined',
                        helperText:
                          'Enter sequence name, feature name, or location',
                        style: { minWidth: '175px' },
                      }}
                    />
                  </FormControl>
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
              <FormControl>
                <Button
                  type="submit"
                  disabled={!value}
                  className={classes.button}
                  variant="contained"
                  color="primary"
                >
                  Open
                </Button>
              </FormControl>
              <FormControl>
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
              </FormControl>
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
