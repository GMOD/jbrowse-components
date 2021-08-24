import React, { useState } from 'react'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
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
  const { assemblyNames, assemblyManager } = session
  const { pluginManager } = getEnv(session)
  const { textSearchManager } = pluginManager.rootModel
  const {
    rankSearchResults,
    isSearchDialogDisplayed,
    error: modelError,
  } = model
  const [selectedAsm, setSelectedAsm] = useState<string>(assemblyNames[0])
  const [error, setError] = useState<Error | string | undefined>(modelError)
  const message = !assemblyNames.length ? 'No configured assemblies' : ''
  const searchScope = model.searchScope(selectedAsm)

  const assembly = assemblyManager.get(selectedAsm)
  const assemblyError = assemblyNames.length
    ? assembly?.error
    : 'No configured assemblies'
  const regions = assembly?.regions || []
  const err = assemblyError || error
  const [mySelectedRegion, setSelectedRegion] = useState<string>()
  const selectedRegion = mySelectedRegion || regions[0]?.refName

  async function handleSelectedRegion(input: string) {
    const newRegion = regions.find(r => selectedRegion === r.refName)
    if (newRegion) {
      model.setDisplayedRegions([newRegion])
      // we use showAllRegions after setDisplayedRegions to make the entire
      // region visible, xref #1703
      model.showAllRegions()
    } else {
      const results = await textSearchManager?.search(
        {
          queryString: input.toLocaleLowerCase(),
          searchType: 'exact',
        },
        searchScope,
        rankSearchResults,
      )
      if (results?.length > 0) {
        model.setSearchResults(results, input.toLocaleLowerCase())
      } else {
        try {
          input && model.navToLocString(input, selectedAsm)
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
                  onSelect={option => setSelectedRegion(option.getLocation())}
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
