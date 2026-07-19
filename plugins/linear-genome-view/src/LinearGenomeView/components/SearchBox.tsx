import type React from 'react'

import BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import {
  ADORNMENT_RESERVE_PX,
  HELP_BUTTON_RESERVE_PX,
  RefNameAutocomplete,
  RefNameAutocompleteEndAdornment,
  useRecentLocations,
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
import type { MenuItem } from '@jbrowse/core/ui'

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
  const { recentLocations, addRecentLocation, clearRecentLocations } =
    useRecentLocations(assemblyName)

  async function navigate(option: BaseResult) {
    try {
      await navigateToSelectedOption({ model, assemblyName, option })
      addRecentLocation(option.getDisplayString())
    } catch (e) {
      console.error(e)
      session.notify(
        e instanceof SearchResultsNotFoundError ? e.message : `${e}`,
        'warning',
      )
    }
  }

  const recentMenuItems: MenuItem[] = recentLocations.length
    ? [
        { type: 'subHeader', label: 'Recent' },
        ...recentLocations.map(loc => ({
          label: loc,
          onClick: () => {
            navigate(new BaseResult({ label: loc })).catch(() => {})
          },
        })),
        { type: 'divider' },
        { label: 'Clear recent locations', onClick: clearRecentLocations },
      ]
    : []

  return (
    <RefNameAutocomplete
      onSelect={option => {
        navigate(option).catch(() => {})
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
      adornmentWidth={
        ADORNMENT_RESERVE_PX + (showHelp ? HELP_BUTTON_RESERVE_PX : 0)
      }
      style={style}
      endAdornment={
        <RefNameAutocompleteEndAdornment
          showHelp={showHelp}
          menuItems={recentMenuItems}
        />
      }
      inputStyle={{
        padding: 0,
        height: WIDGET_HEIGHT,
        background: alpha(theme.palette.background.paper, 0.8),
      }}
    />
  )
})

export default SearchBox
