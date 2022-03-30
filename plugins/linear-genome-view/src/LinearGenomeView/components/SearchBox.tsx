import React from 'react'
import { observer } from 'mobx-react'
import { makeStyles, useTheme, alpha } from '@material-ui/core'
import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import { getSession } from '@jbrowse/core/util'
import { SearchType } from '@jbrowse/core/data_adapters/BaseAdapter'

// locals
import RefNameAutocomplete from './RefNameAutocomplete'
import { dedupe } from './util'
import { LinearGenomeViewModel, SPACING, WIDGET_HEIGHT } from '..'

const useStyles = makeStyles(() => ({
  headerRefName: {
    minWidth: 100,
  },
}))

function SearchBox({
  model,
  showHelp,
}: {
  showHelp?: boolean;
  model: LinearGenomeViewModel;
}) {
  const classes = useStyles()
  const theme = useTheme()
  const session = getSession(model)

  const { textSearchManager, assemblyManager } = session
  const { assemblyNames, rankSearchResults } = model
  const assemblyName = assemblyNames[0]
  const assembly = assemblyManager.get(assemblyName)
  const searchScope = model.searchScope(assemblyName)

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

    return dedupe(
      [...(refNameResults || []), ...(textSearchResults || [])],
      elt => elt.getId(),
    )
  }

  async function handleSelectedRegion(option: BaseResult) {
    let trackId = option.getTrackId()
    let location = option.getLocation()
    const label = option.getLabel()
    try {
      if (assembly?.allRefNames?.includes(location)) {
        model.navToLocString(location)
      } else {
        const results = await fetchResults(label, 'exact')
        if (results && results.length > 1) {
          model.setSearchResults(results, label.toLowerCase())
          return
        } else if (results?.length === 1) {
          location = results[0].getLocation()
          trackId = results[0].getTrackId()
        }

        model.navToLocString(location, assemblyName)
        if (trackId) {
          model.showTrack(trackId)
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
      fetchResults={fetchResults}
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
