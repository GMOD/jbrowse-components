import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { getSession } from '@jbrowse/core/util'
import { Region } from '@jbrowse/core/util/types'
import AssemblySelector from '@jbrowse/core/ui/AssemblySelector'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import {
  Button,
  Card,
  CardContent,
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

const useStyles = makeStyles(theme => ({
  importFormContainer: {
    padding: theme.spacing(2),
  },
  importFormEntry: {
    minWidth: 180,
  },
  button: {
    margin: theme.spacing(2),
  },
}))

type LGV = LinearGenomeViewModel

const ErrorDisplay = observer(({ error }: { error: Error }) => {
  return (
    <Typography variant="h6" color="error">
      {`${error}`}
    </Typography>
  )
})

const ImportForm = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const session = getSession(model)
  const { assemblyNames, assemblyManager } = session
  const { pluginManager } = getEnv(session)
  const { textSearchManager } = pluginManager.rootModel
  const { rankSearchResults } = model
  const [selectedAssembly, setSelectedAssembly] = useState<string>(
    assemblyNames[0],
  )
  const [selectedRegion, setSelectedRegion] = useState<string>()
  const [assemblyRegions, setAssemblyRegions] = useState<Region[]>([])
  const [error, setError] = useState<Error>()
  const message = !assemblyNames.length ? 'No configured assemblies' : ''
  const searchScope = model.searchScope(selectedAssembly)
  useEffect(() => {
    let done = false
    ;(async () => {
      try {
        if (selectedAssembly) {
          const assembly = await assemblyManager.waitForAssembly(
            selectedAssembly,
          )
          if (assembly && assembly.regions) {
            const regions = assembly.regions
            if (!done && regions) {
              setSelectedRegion(regions[0].refName)
              setAssemblyRegions(regions)
            }
          }
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
    return () => {
      done = true
    }
  }, [assemblyManager, selectedAssembly])

  function setSelectedValue(selectedOption: BaseResult) {
    setSelectedRegion(selectedOption.getLocation())
  }

  async function handleSelectedRegion(input: string) {
    const newRegion = assemblyRegions.find(r => selectedRegion === r.refName)
    if (newRegion) {
      model.setDisplayedRegions([newRegion])
      // we use showAllRegions after setDisplayedRegions to make the entire
      // region visible, xref #1703
      model.showAllRegions()
    } else {
      const results =
        (await textSearchManager?.search(
          {
            queryString: input.toLocaleLowerCase(),
            searchType: 'exact',
          },
          searchScope,
          rankSearchResults,
        )) || []
      if (results.length > 0) {
        model.setSearchResults(results, input.toLocaleLowerCase())
      } else {
        try {
          input && model.navToLocString(input, selectedAssembly)
        } catch (e) {
          if (`${e}` === `Error: Unknown reference sequence "${input}"`) {
            model.setSearchResults(results, input.toLocaleLowerCase())
          } else {
            console.warn(e)
            session.notify(`${e}`, 'warning')
          }
        }
      }
    }
  }

  return (
    <div>
      {model.isSearchDialogDisplayed ? (
        <SearchResultsDialog
          model={model}
          optAssemblyName={selectedAssembly}
          handleClose={() => {
            model.setSearchResults(undefined, undefined)
          }}
        />
      ) : null}
      <Container className={classes.importFormContainer}>
        <Grid container spacing={1} justifyContent="center" alignItems="center">
          <Grid item>
            <AssemblySelector
              onChange={val => setSelectedAssembly(val)}
              session={session}
              selected={selectedAssembly}
            />
          </Grid>
          <Grid item>
            {error ? (
              <ErrorDisplay error={error} />
            ) : selectedAssembly ? (
              selectedRegion && model.volatileWidth ? (
                <RefNameAutocomplete
                  model={model}
                  assemblyName={message ? undefined : selectedAssembly}
                  value={selectedRegion}
                  onSelect={option => setSelectedValue(option)}
                  TextFieldProps={{
                    margin: 'normal',
                    variant: 'outlined',
                    helperText: 'Enter a sequence or location',
                    className: classes.importFormEntry,
                    onBlur: event => {
                      if (event.target.value !== '') {
                        setSelectedRegion(event.target.value)
                      }
                    },
                    onKeyPress: event => {
                      const inputValue = (event.target as HTMLInputElement)
                        .value
                      // maybe check regular expression here to see if it's a
                      // locstring try defaulting exact matches to first exact
                      // match
                      if (event.key === 'Enter') {
                        handleSelectedRegion(inputValue)
                      }
                    },
                  }}
                />
              ) : (
                <CircularProgress
                  role="progressbar"
                  color="inherit"
                  size={20}
                  disableShrink
                />
              )
            ) : null}
          </Grid>
          <Grid item>
            <Button
              disabled={!selectedRegion}
              className={classes.button}
              onClick={() => {
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
              onClick={() => model.showAllRegionsInAssembly(selectedAssembly)}
              variant="contained"
              color="secondary"
            >
              Show all regions in assembly
            </Button>
          </Grid>
        </Grid>
      </Container>
    </div>
  )
})

export default ImportForm
