/**
 * Based on https://material-ui.com/components/autocomplete/#Virtualize.tsx
 * Asynchronous Requests for autocomplete: https://material-ui.com/components/autocomplete/
 */
import { Region } from '@jbrowse/core/util/types'
import { getSession } from '@jbrowse/core/util'
import CircularProgress from '@material-ui/core/CircularProgress'
// import ListSubheader from '@material-ui/core/ListSubheader'
import TextField, { TextFieldProps as TFP } from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import Autocomplete, {
  createFilterOptions,
} from '@material-ui/lab/Autocomplete'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import React, { useEffect } from 'react'
// import { ListChildComponentProps, VariableSizeList } from 'react-window'
import { LinearGenomeViewModel } from '..'

// filter for options that were fetched
const filter = createFilterOptions({ trim: true, limit: 36 })

function RefNameAutocomplete({
  model,
  onSelect,
  assemblyName,
  style,
  TextFieldProps = {},
}: {
  model: LinearGenomeViewModel
  onSelect: (region: Region | undefined) => void
  assemblyName?: string
  value?: string
  style?: React.CSSProperties
  TextFieldProps?: TFP
}) {
  const [possibleOptions, setPossibleOptions] = React.useState<Array<any>>([])
  const {
    coarseVisibleLocStrings,
    visibleLocStrings: nonCoarseVisibleLocStrings,
  } = model
  const session = getSession(model)
  const { assemblyManager } = getSession(model)
  const assembly = assemblyName && assemblyManager.get(assemblyName)
  const regions: Region[] = (assembly && assembly.regions) || []
  const visibleLocStrings =
    coarseVisibleLocStrings || nonCoarseVisibleLocStrings
  const loaded = regions.length !== 0

  useEffect(() => {
    let active = true
    /*
    TODO: name indexing, gene search, identifier implementation
    Will need to: 
    1) add method ex: handleFetchOptions for API request when the searchValue changes
    2) dynamically change the array of possibleOptions according to searchValue
      const [searchValue, setSearchValue] = React.useState<any | null>()
    3) Change filterOptions in the autocomplete method to filter accordingly
    4) Modify onInputChange to set the searched Value in the state
    onInputChange={(e, inputValue) => setSearchValue(inputValue)} use this to fetch for newOptions
    */
    if (loaded && active) {
      const options = regions.map(option => {
        return { type: 'reference sequence', value: option.refName }
      })
      setPossibleOptions(options)
      return undefined
    }
    return () => {
      active = false
    }
  }, [loaded, regions])

  function onChange(_: unknown, newRegionName: any | null) {
    if (newRegionName) {
      const newRegion: Region | undefined = regions.find(
        region =>
          region.refName === newRegionName.inputValue ||
          region.refName === newRegionName.value ||
          region.refName === newRegionName,
      )
      if (newRegion) {
        // @ts-ignore
        onSelect(getSnapshot(newRegion))
      } else {
        if (typeof newRegionName === 'string') {
          // fetchNewOptions(newRegionName)
        }
        switch (typeof newRegionName) {
          case 'string':
            navTo(newRegionName)
            break
          default:
            navTo(newRegionName.inputValue || newRegionName.value)
        }
      }
    }
  }

  function navTo(locString: string) {
    try {
      model.navToLocString(locString)
    } catch (e) {
      console.warn(e)
      session.notify(`${e}`, 'warning')
    }
  }

  return (
    <Autocomplete
      id={`refNameAutocomplete-${model.id}`}
      ListboxProps={{ style: { maxHeight: 250 } }}
      data-testid="autocomplete"
      autoComplete
      freeSolo
      selectOnFocus
      disableListWrap
      disableClearable
      style={style}
      loading={loaded}
      value={visibleLocStrings || ''}
      includeInputInList
      disabled={!assemblyName || !loaded}
      options={possibleOptions} // sort them
      groupBy={option => String(option.type)}
      filterOptions={(options, params) => {
        const filtered = filter(options, params)
        // creates new option if user input does not match options
        if (params.inputValue !== '') {
          filtered.push({
            type: 'Search',
            inputValue: params.inputValue,
            value: `Navigate to...${params.inputValue}`,
          })
        }
        return filtered
      }}
      onChange={(e, newRegion) => onChange(e, newRegion)}
      renderInput={params => {
        const { helperText, InputProps = {} } = TextFieldProps
        const TextFieldInputProps = {
          ...params.InputProps,
          ...InputProps,
          endAdornment: (
            <>
              {!loaded ? <CircularProgress color="inherit" size={20} /> : null}
              {params.InputProps.endAdornment}
            </>
          ),
        }
        return (
          <TextField
            {...params}
            {...TextFieldProps}
            helperText={helperText}
            InputProps={TextFieldInputProps}
            placeholder="Search for location"
          />
        )
      }}
      renderOption={option => <Typography noWrap>{option.value}</Typography>}
      getOptionLabel={option => {
        if (typeof option === 'string') {
          return option
        }
        if (option.inputValue) {
          return option.inputValue
        }
        return option.value
      }}
    />
  )
}

export default observer(RefNameAutocomplete)
