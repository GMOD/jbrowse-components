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
const filter = createFilterOptions<Option>({ trim: true, limit: 15 })

export interface Option {
  label: string
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
  const [open, setOpen] = React.useState(false)
  const [currentSearch, setCurrentSearch] = React.useState('')
  const [currentOptions, setCurrentOptions] = React.useState([])
  const [, setError] = React.useState<Error>()
  const session = getSession(model)
  const { assemblyManager } = session
  const assembly = assemblyName && assemblyManager.get(assemblyName)
  const regions: Region[] = (assembly && assembly.regions) || []
  const { coarseVisibleLocStrings } = model
  const loaded = regions.length !== 0
  const loadingSearch = currentOptions.length === 0
  const options: Array<Option> = useMemo(() => {
    const defaultOptions = regions.map(option => {
      return { label: 'reference sequence', value: option.refName }
    })
    return defaultOptions.concat(currentOptions)
  }, [regions, currentOptions])

  // console.log( session.textSearchManager )
  React.useEffect(() => {
    let active = true
    if (active) {
      ;(async () => {
        try {
          // TODO, will be replaced once text search manager is implemented
          const results = await session.textSearchManager.search(currentSearch)
          console.log(results)
          if (results.length > 0) {
            setCurrentOptions(results)
          } 
        } catch (e) {
          console.error(e)
          if (active) {
            setError(e)
          }
        }
      })()
    }
    return () => {
      active = false
      setError(undefined)
    }
  }, [currentSearch, session.textSearchManager])

  React.useEffect(() => {
    if (!open) {
      setCurrentOptions([])
    }
  }, [open])
  function onChange(newRegionName: Option | string) {
    let newRegionValue: string | undefined
    if (newRegionName) {
      if (typeof newRegionName === 'object') {
        newRegionValue = newRegionName.value || newRegionName.inputValue
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
      open={open}
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
      groupBy={option => String(option.label)}
      filterOptions={(possibleOptions, params) => {
        const filtered = filter(possibleOptions, params)
        // creates new option if user input does not match options
        if (params.inputValue !== '') {
          const newOption: Option = {
            label: 'Navigating to...',
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
      onOpen={() => {
        setOpen(true)
      }}
      onClose={() => {
        setOpen(false)
      }}
      renderInput={params => {
        const { helperText, InputProps = {} } = TextFieldProps
        const TextFieldInputProps = {
          ...params.InputProps,
          ...InputProps,
          endAdornment: (
            <>
              {!loaded && !loadingSearch ? (
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
            // error={!!error}
            helperText={helperText}
            value={coarseVisibleLocStrings || value || ''}
            InputProps={TextFieldInputProps}
            placeholder="Search for location"
            onChange={e => setCurrentSearch(e.target.value)}
          />
        )
      }}
      renderOption={option => (
        <Typography noWrap>{option.inputValue || option.value}</Typography>
      )}
      getOptionLabel={option => {
        // handles locstrings
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
