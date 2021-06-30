import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { getSession } from '@jbrowse/core/util'
import { Region } from '@jbrowse/core/util/types'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
// material ui
import { makeStyles } from '@material-ui/core/styles'
import Button from '@material-ui/core/Button'
import CircularProgress from '@material-ui/core/CircularProgress'
import TextField from '@material-ui/core/TextField'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'
import MenuItem from '@material-ui/core/MenuItem'
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

const ImportForm = observer(({ model }: { model: LGV }) => {
  const classes = useStyles()
  const session = getSession(model)
  const { assemblyNames, assemblyManager } = session
  const { pluginManager } = getEnv(session)
  const { textSearchManager } = pluginManager.rootModel
  const { rankSearchResults } = model
  const [selectedAssemblyIdx, setSelectedAssemblyIdx] = useState(0)
  const [selectedRegion, setSelectedRegion] = useState<string | undefined>(
    undefined,
  )
  const [assemblyRegions, setAssemblyRegions] = useState<Region[]>([])
  const error = !assemblyNames.length ? 'No configured assemblies' : ''
  const hasError = Boolean(error)
  const assemblyName = assemblyNames[selectedAssemblyIdx]
  const displayName = assemblyName && !error ? selectedAssemblyIdx : ''
  const searchScope = model.searchScope(assemblyName)
  useEffect(() => {
    let done = false
    ;(async () => {
      if (assemblyName) {
        const assembly = await assemblyManager.waitForAssembly(assemblyName)
        if (assembly && assembly.regions) {
          const regions = assembly.regions
          if (!done && regions) {
            setSelectedRegion(regions[0].refName)
            setAssemblyRegions(regions)
          }
        }
      }
    })()
    return () => {
      done = true
    }
  }, [assemblyManager, assemblyName])

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
          input && model.navToLocString(input, assemblyName)
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
          optAssemblyName={assemblyName}
          handleClose={() => {
            model.setSearchResults(undefined, undefined)
          }}
        />
      ) : null}
      <Container className={classes.importFormContainer}>
        <Grid container spacing={1} justify="center" alignItems="center">
          <Grid item>
            <TextField
              select
              variant="outlined"
              value={displayName}
              onChange={event => {
                setSelectedAssemblyIdx(Number(event.target.value))
              }}
              label="Assembly"
              helperText={error || 'Select assembly to view'}
              error={hasError}
              disabled={hasError}
              margin="normal"
              className={classes.importFormEntry}
            >
              {assemblyNames.map((name, idx) => (
                <MenuItem key={name} value={idx}>
                  {name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item>
            {assemblyName ? (
              selectedRegion !== undefined && model.volatileWidth ? (
                <RefNameAutocomplete
                  model={model}
                  assemblyName={
                    error ? undefined : assemblyNames[selectedAssemblyIdx]
                  }
                  value={selectedRegion}
                  onSelect={option => {
                    setSelectedValue(option)
                  }}
                  TextFieldProps={{
                    margin: 'normal',
                    variant: 'outlined',
                    className: classes.importFormEntry,
                    helperText: 'Enter a sequence or locstring',
                    onBlur: event => {
                      if ((event.target as HTMLInputElement).value !== '') {
                        setSelectedRegion(
                          (event.target as HTMLInputElement).value,
                        )
                      }
                    },
                    onKeyPress: event => {
                      const inputValue = (event.target as HTMLInputElement)
                        .value
                      // maybe check regular expression here to see if it's a locstring
                      // try defaulting exact matches to first exact match
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
              onClick={() => {
                model.showAllRegionsInAssembly(assemblyName)
              }}
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
