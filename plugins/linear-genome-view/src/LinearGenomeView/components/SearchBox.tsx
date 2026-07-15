import type React from 'react'

import {
  RefNameAutocomplete,
  RefNameAutocompleteEndAdornment,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import {
  SearchResultsNotFoundError,
  fetchResults,
  navigateToSelectedOption,
} from '../../searchUtils.ts'
import { SPACING, WIDGET_HEIGHT } from '../consts.ts'

import type { LinearGenomeViewModel } from '../model.ts'

const defaultStyle = { margin: SPACING }

const SearchBox = observer(function SearchBox({
  model,
  showHelp = true,
  minWidth = 175,
  maxWidth,
  style = defaultStyle,
}: {
  showHelp?: boolean
  model: LinearGenomeViewModel
  minWidth?: number
  maxWidth?: number
  style?: React.CSSProperties
}) {
  const theme = useTheme()
  const session = getSession(model)
  const { textSearchManager, assemblyManager } = session
  const { assemblyNames } = model
  const assemblyName = assemblyNames[0]!
  const assembly = assemblyManager.get(assemblyName)
  const searchScope = model.searchScope(assemblyName)

  return (
    <RefNameAutocomplete
      onSelect={async option => {
        try {
          await navigateToSelectedOption({ model, assemblyName, option })
        } catch (e) {
          console.error(e)
          session.notify(
            e instanceof SearchResultsNotFoundError ? e.message : `${e}`,
            'warning',
          )
        }
      }}
      assemblyName={assemblyName}
      fetchResults={queryString =>
        fetchResults({
          queryString,
          searchScope,
          textSearchManager,
          assembly,
        })
      }
      session={session}
      value={model.coarseVisibleLocStrings}
      minWidth={minWidth}
      maxWidth={maxWidth}
      style={style}
      endAdornment={<RefNameAutocompleteEndAdornment showHelp={showHelp} />}
      inputStyle={{
        padding: 0,
        height: WIDGET_HEIGHT,
        background: alpha(theme.palette.background.paper, 0.8),
      }}
    />
  )
})

export default SearchBox
