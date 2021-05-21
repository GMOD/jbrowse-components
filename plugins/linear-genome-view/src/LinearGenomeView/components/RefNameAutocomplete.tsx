/**
 * Based on https://material-ui.com/components/autocomplete/#Virtualize.tsx
 * Asynchronous Requests for autocomplete: https://material-ui.com/components/autocomplete/
 */
import React, { useMemo } from 'react'
import { observer } from 'mobx-react'
import { Region } from '@jbrowse/core/util/types'
import { getSession } from '@jbrowse/core/util'
// material ui
import CircularProgress from '@material-ui/core/CircularProgress'
import TextField, { TextFieldProps as TFP } from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import SearchIcon from '@material-ui/icons/Search'
import { InputAdornment } from '@material-ui/core'
import Autocomplete, {
  createFilterOptions,
} from '@material-ui/lab/Autocomplete'
// other
import { LinearGenomeViewModel } from '..'

// filter for options that were fetched
const filter = createFilterOptions<Option>({ trim: true, limit: 36 })

export interface Option {
  type: string
  value: string
  inputValue?: string
}

function RefNameAutocomplete({
  model,
  onSelect,
  assemblyName,
  style,
  value,
  TextFieldProps = {},
}: {
  model: LinearGenomeViewModel
  onSelect: (region: string | undefined) => void
  assemblyName?: string
  value?: string
  style?: React.CSSProperties
  TextFieldProps?: TFP
}) {
  const session = getSession(model)
  const { assemblyManager } = session
  const assembly = assemblyName && assemblyManager.get(assemblyName)
  const regions = useMemo(
    () => (assembly && assembly.regions) || ([] as Region[]),
    [assembly],
  )
  const { coarseVisibleLocStrings } = model
  const loaded = regions.length !== 0
  const options = useMemo(
    () =>
      regions.map(option => ({
        type: 'reference sequence',
        value: option.refName,
      })) as Option[],
    [regions],
  )

  function onChange(newRegionName: Option | string) {
    let newRegionValue: string | undefined
    if (newRegionName) {
      if (typeof newRegionName === 'object') {
        newRegionValue = newRegionName.inputValue || newRegionName.value
      }
      if (typeof newRegionName === 'string') {
        newRegionValue = newRegionName
      }
      onSelect(newRegionValue)
    }
  }

  return (
    <Autocomplete
      id={`refNameAutocomplete-${model.id}`}
      data-testid="autocomplete"
      disabled={!assemblyName || !loaded}
      disableListWrap
      disableClearable
      freeSolo
      includeInputInList
      clearOnBlur
      loading={loaded}
      selectOnFocus
      style={style}
      value={coarseVisibleLocStrings || value || ''}
      options={options}
      groupBy={option => String(option.type)}
      filterOptions={(possibleOptions, params) => {
        const filtered = filter(possibleOptions, params)
        // creates new option if user input does not match options
        if (params.inputValue !== '') {
          const newOption: Option = {
            type: 'Search',
            inputValue: params.inputValue,
            value: params.inputValue,
          }
          filtered.push(newOption)
        }
        return filtered
      }}
      ListboxProps={{ style: { maxHeight: 250 } }}
      onChange={(_, newRegion) => {
        onChange(newRegion)
      }}
      renderInput={params => {
        const { helperText, InputProps = {} } = TextFieldProps
        const TextFieldInputProps = {
          ...params.InputProps,
          ...InputProps,
          endAdornment: (
            <>
              {!loaded ? (
                <CircularProgress color="inherit" size={20} />
              ) : (
                <InputAdornment position="end" style={{ marginRight: 7 }}>
                  <SearchIcon />
                </InputAdornment>
              )}
              {params.InputProps.endAdornment}
            </>
          ),
        }
        return (
          <TextField
            {...params}
            {...TextFieldProps}
            helperText={helperText}
            value={coarseVisibleLocStrings || value || ''}
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
