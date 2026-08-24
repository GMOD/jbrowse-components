import {
  RefNameAutocomplete,
  RefNameAutocompleteEndAdornment,
  adornmentReservePx,
  getInputWidth,
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

// The header box's floor and ceiling. A stacked view's row passes its own, and
// `searchBoxWidth` answers for these.
const MIN_WIDTH = 175
const MAX_WIDTH = 550

/**
 * What the box asks its row for at `value`, margins included — the number
 * `headerFit` sheds against.
 *
 * The ask follows the locstring, which is the whole point of asking: 194px at
 * `ctgA:1..20,000` and 284px at `chr22:10,510,000..10,610,000`, so a row sized
 * against the 189px floor sheds too little and flexbox squeezes the box anyway.
 * It is `getInputWidth`, the same function the box sizes itself with, rather
 * than that arithmetic done again out here.
 *
 * `showHelp` is the component's own default below, and with help on
 * `adornmentReservePx` returns the same number whatever the recent-locations
 * menu holds — so the count only this component's hook knows cannot change the
 * answer.
 */
export function searchBoxWidth(value: string) {
  return (
    getInputWidth(
      value,
      MIN_WIDTH,
      MAX_WIDTH,
      adornmentReservePx({ showHelp: true }),
    ) +
    2 * SPACING
  )
}

const SearchBox = observer(function SearchBox({
  model,
  showHelp = true,
  minWidth = MIN_WIDTH,
  maxWidth = MAX_WIDTH,
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
