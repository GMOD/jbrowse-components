import React, { useState, useEffect } from 'react'
import { observer } from 'mobx-react'
import { getSession, isSessionWithAddTracks } from '@jbrowse/core/util'
import {
  Button,
  Container,
  CircularProgress,
  Grid,
  TextField,
  makeStyles,
} from '@material-ui/core'
import { ErrorMessage, AssemblySelector } from '@jbrowse/core/ui'
import { MultilevelLinearViewModel } from '../model'
import CloseIcon from '@material-ui/icons/Close'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { SearchType } from '@jbrowse/core/data_adapters/BaseAdapter'

import RefNameAutocomplete from '@jbrowse/plugin-linear-genome-view/src/LinearGenomeView/components/RefNameAutocomplete'

const useStyles = makeStyles(theme => ({
  importFormContainer: {
    padding: theme.spacing(4),
  },

  formPaper: {
    margin: '0 auto',
    padding: 12,
    marginBottom: 10,
  },
}))

const ImportForm = observer(
  ({ model }: { model: MultilevelLinearViewModel }) => {
    const classes = useStyles()
    const session = getSession(model)
    const { assemblyNames, assemblyManager } = session
    const [selected, setSelected] = useState([assemblyNames[0]])
    const [numViews, setNumViews] = useState('2')
    const [error, setError] = useState<unknown>()

    const assemblyError = assemblyNames.length
      ? selected
          .map(a => assemblyManager.get(a)?.error)
          .filter(f => !!f)
          .join(', ')
      : 'No configured assemblies'

    const [myOption, setOption] = useState<BaseResult>()
    const assembly = assemblyManager.get(selected[0])

    const regions = assembly?.regions || []

    const option =
      myOption ||
      new BaseResult({
        label: regions[0]?.refName,
      })

    const selectedRegion = option?.getLocation()

    useEffect(() => {
      const num = parseInt(numViews, 10)
      if (!Number.isNaN(num)) {
        if (num > 1) {
          setSelected(Array(num).fill(assemblyNames[0]))
        } else {
          setNumViews('2')
        }
      }
    }, [numViews, assemblyNames])

    // gets a string as input, or use stored option results from previous query,
    // then re-query and
    // 1) if it has multiple results: pop a dialog
    // 2) if it's a single result navigate to it
    // 3) else assume it's a locstring and navigate to it
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async function handleSelectedRegion(input: string, model: any) {
      if (!option) {
        return
      }
      let trackId = option.getTrackId()
      let location = input || option.getLocation() || ''
      try {
        if (assembly?.allRefNames?.includes(location)) {
          model.navToLocString(location, selected[0])
        } else {
          const results = await fetchResults(input, 'exact')
          if (results && results.length > 1) {
            model.setSearchResults(results, input.toLowerCase())
            return
          } else if (results?.length === 1) {
            location = results[0].getLocation()
            trackId = results[0].getTrackId()
          }
          model.navToLocString(location, selected[0])
          if (trackId) {
            model.showTrack(trackId)
          }
        }
      } catch (e) {
        console.error(e)
        session.notify(`${e}`, 'warning')
      }
    }

    async function onOpenClick() {
      try {
        if (!isSessionWithAddTracks(session)) {
          return
        }
        model.setViews(
          await Promise.all(
            selected.map(async selection => {
              const assembly = await assemblyManager.waitForAssembly(selection)
              if (!assembly) {
                throw new Error(`Assembly ${selection} failed to load`)
              }
              return {
                type: 'LinearGenomeView' as const,
                bpPerPx: 1,
                offsetPx: 0,
                hasCustomHeader: true,
                displayedRegions: assembly.regions,
              }
            }),
          ),
        )

        let zoomVal = 1
        let num = 2
        model.views.forEach(view => {
          view.setWidth(model.width)
          view.setCustomMiniControls(true)
          if (selectedRegion) {
            handleSelectedRegion(selectedRegion, view)
          }

          view.zoomTo(zoomVal)
          zoomVal *= num
          num++
        })
      } catch (e) {
        console.error(e)
        setError(e)
      }
    }

    async function fetchResults(query: string, searchType?: SearchType) {
      const { textSearchManager } = session
      if (!textSearchManager) {
        console.warn('No text search manager')
      }

      const textSearchResults = await textSearchManager?.search(
        {
          queryString: query,
          searchType,
        },
        model.views[model.anchorViewIndex].searchScope(selected[0]),
        model.views[model.anchorViewIndex].rankSearchResults,
      )

      const refNameResults = assembly?.allRefNames
        ?.filter(refName => refName.startsWith(query))
        .map(r => new BaseResult({ label: r }))
        .slice(0, 10)

      return [...(refNameResults || []), ...(textSearchResults || [])]
    }

    // this is a combination of any displayed error message we have
    const displayError = error || assemblyError
    return (
      <Container className={classes.importFormContainer}>
        {displayError ? <ErrorMessage error={displayError} /> : null}
        <Grid container spacing={1} justifyContent="center" alignItems="center">
          <Grid item>
            <AssemblySelector
              onChange={val => {
                setError(undefined)
                setSelected([val, val, val])
              }}
              session={session}
              selected={selected[0]}
            />
          </Grid>
          <Grid item>
            {selected[0] ? (
              error ? (
                <CloseIcon style={{ color: 'red' }} />
              ) : selectedRegion ? (
                <RefNameAutocomplete
                  fetchResults={fetchResults}
                  // @ts-ignore
                  model={model}
                  assemblyName={assemblyError ? undefined : selected[0]}
                  value={selectedRegion}
                  // note: minWidth 270 accomodates full width of helperText
                  minWidth={270}
                  onSelect={option => setOption(option)}
                  TextFieldProps={{
                    margin: 'normal',
                    variant: 'outlined',
                    helperText:
                      'Enter sequence name, feature name, or location',
                  }}
                />
              ) : (
                <CircularProgress role="progressbar" size={20} disableShrink />
              )
            ) : null}
          </Grid>
          <Grid item>
            <TextField
              value={numViews}
              type="number"
              variant="outlined"
              margin="normal"
              onChange={event => setNumViews(event.target.value)}
              style={{ width: '8rem', verticalAlign: 'baseline' }}
              helperText="Number of views"
            />
          </Grid>
          <Grid item>
            <Button
              disabled={!!assemblyError}
              onClick={onOpenClick}
              variant="contained"
              color="primary"
              style={{ marginBottom: '1rem' }}
            >
              Open
            </Button>
          </Grid>
        </Grid>
      </Container>
    )
  },
)

export default ImportForm
