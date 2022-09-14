import React from 'react'
import { observer } from 'mobx-react'
import { useTheme, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { getSession } from '@jbrowse/core/util'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'

// locals
import RefNameAutocomplete from './RefNameAutocomplete'
import { fetchResults, splitLast } from './util'
import { LinearGenomeViewModel, SPACING, WIDGET_HEIGHT } from '..'

const useStyles = makeStyles()(() => ({
  headerRefName: {
    minWidth: 100,
  },
}))

function SearchBox({
  model,
  showHelp,
}: {
  showHelp?: boolean
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
  const theme = useTheme()
  const session = getSession(model)

  const { textSearchManager, assemblyManager } = session
  const { assemblyNames, rankSearchResults } = model
  const assemblyName = assemblyNames[0]
  const assembly = assemblyManager.get(assemblyName)
  const searchScope = model.searchScope(assemblyName)

  function navToOption(option: BaseResult) {
    const location = option.getLocation()
    const trackId = option.getTrackId()
    if (location) {
      model.navToLocString(location, assemblyName)
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
  async function handleSelectedRegion(option: BaseResult) {
    try {
      if (option.hasLocation()) {
        navToOption(option)
      } else {
        const input = option.getLabel()
        const [ref, rest] = splitLast(input, ':')
        const allRefs = assembly?.allRefNamesWithLowerCase || []
        if (
          allRefs.includes(input) ||
          (allRefs.includes(ref) && !Number.isNaN(parseInt(rest, 10)))
        ) {
          model.navToLocString(input, assemblyName)
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
            model.navToLocString(input, assemblyName)
          }
        }
      }
    } catch (e) {
      console.error(e)
      session.notify(`${e}`, 'warning')
    }
  }
  return (
    <RefNameAutocomplete
      showHelp={showHelp}
      onSelect={handleSelectedRegion}
      assemblyName={assemblyName}
      fetchResults={queryString =>
        fetchResults({
          queryString,
          searchScope,
          rankSearchResults,
          textSearchManager,
          assembly,
        })
      }
      model={model}
      TextFieldProps={{
        variant: 'outlined',
        className: classes.headerRefName,
        style: { margin: SPACING, minWidth: '175px' },
        InputProps: {
          style: {
            padding: 0,
            height: WIDGET_HEIGHT,
            background: alpha(theme.palette.background.paper, 0.8),
          },
        },
      }}
    />
  )
}

export default observer(SearchBox)
