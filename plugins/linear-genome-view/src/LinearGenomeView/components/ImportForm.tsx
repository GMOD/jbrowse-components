import { useState } from 'react'

import {
  AssemblySelector,
  ErrorBanner,
  RefNameAutocomplete,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import CloseIcon from '@mui/icons-material/Close'
import {
  Button,
  CircularProgress,
  Container,
  FormControl,
  Grid as Grid,
} from '@mui/material'
import { observer } from 'mobx-react'

import {
  fetchResults,
  handleSelectedRegion,
  navToOption,
} from '../../searchUtils.ts'

import type { LinearGenomeViewModel } from '../index.ts'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'

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

const LinearGenomeViewImportForm = observer(
  function LinearGenomeViewImportForm({ model }: { model: LGV }) {
    const { classes } = useStyles()
    const session = getSession(model)
    const { assemblyNames, assemblyManager, textSearchManager } = session
    const { rankSearchResults } = model
    const { initialized, error } = model
    const [selectedAsm, setSelectedAsm] = useState(assemblyNames[0]!)
    const [option, setOption] = useState<BaseResult>()
    const assembly = assemblyManager.get(selectedAsm)
    const assemblyError = assemblyNames.length
      ? assembly?.error
      : 'No configured assemblies'
    const displayError = assemblyError || error
    // userValue is null until the user types or selects something,
    // at which point it overrides the default first-region value
    const [userValue, setUserValue] = useState<string | null>(null)
    const regions = assembly?.regions
    const assemblyLoaded = !!regions
    const r0 = regions?.[0]?.refName ?? ''
    const value = userValue ?? r0
    const searchScope = model.searchScope(selectedAsm)
    const setValue = (v: string) => {
      setUserValue(v)
    }

    // implementation notes:
    // having this wrapped in a form allows intuitive use of enter key to submit
    return (
      <div className={classes.container}>
        {displayError ? <ErrorBanner error={displayError} /> : null}
        {initialized ? (
          <Container className={classes.importFormContainer}>
            <form
              onSubmit={async event => {
                event.preventDefault()
                model.setError(undefined)
                if (value) {
                  // has it's own error handling
                  try {
                    if (
                      option?.getDisplayString() === value &&
                      option.hasLocation()
                    ) {
                      await navToOption({
                        option,
                        model,
                        assemblyName: selectedAsm,
                      })
                    } else if (option?.results?.length) {
                      model.setSearchResults(
                        option.results,
                        option.getLabel(),
                        selectedAsm,
                      )
                    } else if (assembly) {
                      await handleSelectedRegion({
                        input: value,
                        assemblyName: selectedAsm,
                        model,
                      })
                    }
                  } catch (e) {
                    console.error(e)
                    session.notify(`${e}`, 'warning')
                  }
                }
              }}
            >
              <Grid
                container
                spacing={1}
                sx={{ justifyContent: 'center', alignItems: 'center' }}
              >
                <FormControl>
                  <AssemblySelector
                    onChange={val => {
                      setSelectedAsm(val)
                      setUserValue(null)
                      setOption(undefined)
                    }}
                    localStorageKey="lgv"
                    session={session}
                    selected={selectedAsm}
                  />
                </FormControl>
                {selectedAsm ? (
                  assemblyError ? (
                    <CloseIcon style={{ color: 'red' }} />
                  ) : assemblyLoaded ? (
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
                        session={session}
                        assemblyName={selectedAsm}
                        value={value}
                        minWidth={270}
                        onChange={setValue}
                        onSelect={setOption}
                        helperText="Enter sequence name, feature name, or location"
                      />
                    </FormControl>
                  ) : (
                    <CircularProgress size={20} disableShrink />
                  )
                ) : null}
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
            </form>
          </Container>
        ) : null}
      </div>
    )
  },
)

export default LinearGenomeViewImportForm
