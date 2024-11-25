import React from 'react'
import { getSession } from '@jbrowse/core/util'
import { useTheme, alpha } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import RefNameAutocomplete from './RefNameAutocomplete'
import { fetchResults } from './util'
import { handleSelectedRegion, navToOption } from '../../searchUtils'
import { SPACING, WIDGET_HEIGHT } from '../consts'
import type { LinearGenomeViewModel } from '..'

const useStyles = makeStyles()(() => ({
  headerRefName: {
    minWidth: 100,
  },
}))

const SearchBox = observer(function ({
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
  const assemblyName = assemblyNames[0]!
  const assembly = assemblyManager.get(assemblyName)
  const searchScope = model.searchScope(assemblyName)

  return (
    <RefNameAutocomplete
      showHelp={showHelp}
      onSelect={async option => {
        try {
          if (option.hasLocation()) {
            await navToOption({ option, model, assemblyName })
          } else if (option.results?.length) {
            model.setSearchResults(option.results, option.getLabel())
          } else if (assembly) {
            await handleSelectedRegion({
              input: option.getLabel(),
              assembly,
              model,
            })
          }
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
})

export default SearchBox
