import React from 'react'
import { observer } from 'mobx-react'
import { useTheme, alpha } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { getSession } from '@jbrowse/core/util'

// locals
import RefNameAutocomplete from './RefNameAutocomplete'
import { fetchResults } from './util'
import { LinearGenomeViewModel, SPACING, WIDGET_HEIGHT } from '..'
import { handleSelectedRegion, navToOption } from '../../searchUtils'

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
  const assemblyName = assemblyNames[0]
  const assembly = assemblyManager.get(assemblyName)
  const searchScope = model.searchScope(assemblyName)

  return (
    <RefNameAutocomplete
      showHelp={showHelp}
      onSelect={async option => {
        try {
          if (option.hasLocation()) {
            await navToOption({ assemblyName, model, option })
          } else if (option.results?.length) {
            model.setSearchResults(option.results, option.getLabel())
          } else if (assembly) {
            await handleSelectedRegion({
              assembly,
              input: option.getLabel(),
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
          assembly,
          queryString,
          rankSearchResults,
          searchScope,
          textSearchManager,
        })
      }
      model={model}
      minWidth={175}
      TextFieldProps={{
        InputProps: {
          style: {
            background: alpha(theme.palette.background.paper, 0.8),
            height: WIDGET_HEIGHT,
            padding: 0,
          },
        },
        className: classes.headerRefName,
        style: { margin: SPACING },
        variant: 'outlined',
      }}
    />
  )
})

export default SearchBox
