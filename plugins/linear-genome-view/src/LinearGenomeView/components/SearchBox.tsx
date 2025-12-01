import { getSession } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { alpha, useTheme } from '@mui/material'
import { observer } from 'mobx-react'

import RefNameAutocomplete from './RefNameAutocomplete'
import EndAdornment from './RefNameAutocomplete/EndAdornment'
import { fetchResults } from './util'
import { handleSelectedRegion, navToOption } from '../../searchUtils'
import { SPACING, WIDGET_HEIGHT } from '../consts'

import type { LinearGenomeViewModel } from '../model'
import type BaseResult from '@jbrowse/core/TextSearch/BaseResults'

const useStyles = makeStyles()({
  headerRefName: {
    minWidth: 100,
  },
})

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
    model.setSearchResults(option.results, option.getLabel())
  } else if (assembly) {
    await handleSelectedRegion({
      input: option.getLabel(),
      assembly,
      model,
    })
  }
}

const SearchBox = observer(function ({
  model,
  showHelp = true,
}: {
  showHelp?: boolean
  model: LinearGenomeViewModel
}) {
  const { classes } = useStyles()
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
          await onSelect({
            model,
            assemblyName,
            option,
          })
        } catch (e) {
          console.error(e)
          getSession(model).notify(`${e}`, 'warning')
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
      minWidth={175}
      TextFieldProps={{
        variant: 'outlined',
        className: classes.headerRefName,
        style: {
          margin: SPACING,
        },
        slotProps: {
          input: {
            style: {
              padding: 0,
              height: WIDGET_HEIGHT,
              background: alpha(theme.palette.background.paper, 0.8),
            },
            endAdornment: <EndAdornment showHelp={showHelp} />,
          },
        },
      }}
    />
  )
})

export default SearchBox
