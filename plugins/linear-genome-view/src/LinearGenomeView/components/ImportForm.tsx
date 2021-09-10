import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getSession } from '@jbrowse/core/util'
// import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
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

    return results?.filter(
      (elem, index, self) =>
        index === self.findIndex(t => t.getId() === elem.getId()),
    )
  }
  async function handleSelectedRegion(input: string) {
    let trackId = optionTrackId
    let location = optionLocation
    const newRegion = regions.find(r => selectedRegion === r.refName)
    if (newRegion) {
      model.setDisplayedRegions([newRegion])
      // we use showAllRegions after setDisplayedRegions to make the entire
      // region visible, xref #1703
      model.showAllRegions()
    } else {
      const results = await fetchResults(input)
      if (results && results.length > 1) {
        model.setSearchResults(results, input.toLowerCase())
      } else {
        if (results?.length === 1) {
          location = results[0].getLocation()
          trackId = results[0].getTrackId()
        }
        try {
          if (location) {
            model.navToLocString(location, selectedAsm)
          }
        } catch (e) {
          if (`${e}` === `Error: Unknown reference sequence "${input}"`) {
            model.setSearchResults(results, input.toLocaleLowerCase())
          } else {
            console.warn(e)
            session.notify(`${e}`, 'warning')
          }
        }
        try {
          if (trackId) {
            model.showTrack(trackId)
          }
        } catch (e) {
          console.warn(
            `'${e}' occurred while attempting to show track: ${trackId}`,
          )
        }
      }
    }
  }

  return (
    <div>
      {err ? <ErrorDisplay error={err} /> : null}
      <Container className={classes.importFormContainer}>
        <Grid container spacing={1} justifyContent="center" alignItems="center">
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
                    setSelectedRegion(option.getLabel())
                    setOptionTrackId(option.getTrackId() || '')
                    setOptionLocation(option.getLocation())
                  }}
                  TextFieldProps={{
                    margin: 'normal',
                    variant: 'outlined',
                    helperText: 'Enter a sequence or location',
                    onBlur: event => {
                      if (event.target.value !== '') {
                        setSelectedRegion(event.target.value)
                      } else {
                        setSelectedRegion(regions[0].refName)
                      }
                    },
                    onKeyPress: event => {
                      const elt = event.target as HTMLInputElement
                      // maybe check regular expression here to see if it's a
                      // locstring try defaulting exact matches to first exact
                      // match
                      if (event.key === 'Enter') {
                        handleSelectedRegion(elt.value)
                      }
                    },
                  }}
                />
              ) : (
                <CircularProgress role="progressbar" size={20} disableShrink />
              )
            ) : null}
          </Grid>
          <Grid item>
            <Button
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
