import {
  RefNameAutocomplete,
  RefNameAutocompleteEndAdornment,
  adornmentReservePx,
  useRecentLocations,
} from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import {
  fetchResults,
  navigateToSelectedOption,
  notifySearchFailure,
} from '../../searchUtils.ts'
import { SPACING, WIDGET_HEIGHT } from '../consts.ts'
import { recentLocationOf, recentLocationsMenu } from './recentLocationsMenu.ts'

import type { LinearGenomeViewModel } from '../model.ts'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'
import type React from 'react'

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
  const { recentLocations, addRecentLocation, clearRecentLocations } =
    useRecentLocations(assemblyName)

  async function navigate(option: BaseResult) {
    try {
      await navigateToSelectedOption({ model, assemblyName, option })
      addRecentLocation(recentLocationOf(option))
    } catch (e) {
      notifySearchFailure(session, e)
    }
  }

  const recentMenuItems = recentLocationsMenu({
    recentLocations,
    onNavigate: option => {
      navigate(option).catch(() => {})
    },
    onClear: clearRecentLocations,
  })

  return (
    <RefNameAutocomplete
      onSelect={option => {
        navigate(option).catch(() => {})
      }}
      assemblyName={assemblyName}
      fetchResults={(queryString, stopToken) =>
        fetchResults({
          queryString,
          assemblyName,
          textSearchManager,
          assembly,
          stopToken,
        })
      }
      session={session}
      value={model.coarseVisibleLocStrings}
      minWidth={minWidth}
      maxWidth={maxWidth}
      adornmentWidth={adornmentReservePx({
        showHelp,
        menuItemCount: recentMenuItems.length,
      })}
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
