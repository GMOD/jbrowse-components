import type React from 'react'

import { getSession } from '@jbrowse/core/util'
import { alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import EndAdornment from './RefNameAutocomplete/EndAdornment.tsx'
import RefNameAutocomplete from './RefNameAutocomplete/index.tsx'
import { fetchResults, handleSelectedRegion, navToOption } from '../../searchUtils.ts'
import { SPACING, WIDGET_HEIGHT } from '../consts.ts'

const defaultStyle = { margin: SPACING }

import type { LinearGenomeViewModel } from '../model.ts'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'

async function onSelect({
  option,
  model,
  assemblyName,
}: {
  option: BaseResult
  model: LinearGenomeViewModel
  assemblyName: string
}) {
  const { assemblyManager } = getSession(model)
  const assembly = assemblyManager.get(assemblyName)
  if (option.hasLocation()) {
    await navToOption({
      option,
      model,
      assemblyName,
    })
  } else if (option.results?.length) {
    model.setSearchResults(option.results, option.getLabel(), assemblyName)
  } else if (assembly) {
    await handleSelectedRegion({
      input: option.getLabel(),
      assemblyName,
      model,
    })
  }
}

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
  const { assemblyNames, rankSearchResults } = model
  const assemblyName = assemblyNames[0]!
  const assembly = assemblyManager.get(assemblyName)
  const searchScope = model.searchScope(assemblyName)

  return (
    <RefNameAutocomplete
      onSelect={async option => {
        try {
          await onSelect({ model, assemblyName, option })
        } catch (e) {
          console.error(e)
          session.notify(`${e}`, 'warning')
        }
      }}
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
      minWidth={minWidth}
      maxWidth={maxWidth}
      style={style}
      endAdornment={<EndAdornment showHelp={showHelp} />}
      inputStyle={{
        padding: 0,
        height: WIDGET_HEIGHT,
        background: alpha(theme.palette.background.paper, 0.8),
      }}
    />
  )
})

export default SearchBox
