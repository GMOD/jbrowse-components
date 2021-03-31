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
import JbrowseTextSearchAdapter from '@jbrowse/core/TextSearch/JbrowseTextSeachAdapter/JbrowseTextSearchAdater'
import { configSchema } from '@jbrowse/core/TextSearch/JbrowseTextSeachAdapter/index'
import { LinearGenomeViewModel } from '..'

// filter for options that were fetched
const filter = createFilterOptions<Option>({ trim: true, limit: 36 })

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
  const [currentSearch, setCurrentSearch] = React.useState('')
  const [currentOptions, setCurrentOptions] = React.useState([])
  const [, setError] = React.useState<Error>()
  const session = getSession(model)
  const { assemblyManager } = session
  const assembly = assemblyName && assemblyManager.get(assemblyName)
  const regions: Region[] = (assembly && assembly.regions) || []
  const { coarseVisibleLocStrings } = model
  const loaded = regions.length !== 0
  // default region refNames and results from search
  const options: Array<Option> = useMemo(() => {
    const defaultOptions = regions.map(option => {
      return { label: 'reference sequence', value: option.refName }
    })
    return defaultOptions.concat(currentOptions)
  }, [regions, currentOptions])

  React.useEffect(() => {
    let active = true
    if (active) {
      ;(async () => {
        try {
          // TODO, will be replaced once text search manager is implemented
          const test = new JbrowseTextSearchAdapter(configSchema)
          const results = await test.searchIndex(currentSearch, 'exact')
          if (results.length > 0) {
            setCurrentOptions(formatOptions(results))
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
  }, [currentSearch])

  // async function fetchResults(query: string) {
  //   try {
  //     const test = new JbrowseTextSearchAdapter(configSchema)
  //     const results = await test.searchIndex(currentSearch, 'exact')
  //     return results
  //     console.log(results)
  //   } catch (err) {
  //     console.log(err)
  //   }
  //   return []
  // }

  function formatOptions(results) {
    // after fetching the options from adapters, format to place them in dropdown
    // setCurrentOptions([])
    if (results.length === 0) {
      return []
    }
    const formattedOptions = results.map(result => {
      if (result && typeof result === 'object' && result.length > 1) {
        const val = result[0]
        const refName = result[3]
        const start = result[4]
        const end = result[5]
        const formattedResult: Option = {
          label: 'text search adapter',
          value: `${val} ${refName}:${start}-${end}`,
        }
        return formattedResult
      }
      const defaultOption: Option = {
        label: 'text search adapter',
        value: result,
      }
      return defaultOption
    })
    return formattedOptions
  }
  function onChange(newRegionName: Option | string) {
    //
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
      groupBy={option => String(option.label)}
      filterOptions={(possibleOptions, params) => {
        const filtered = filter(possibleOptions, params)
        // creates new option if user input does not match options
        if (params.inputValue !== '') {
          const newOption: Option = {
            label: 'Search',
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
      onClose={() => {
        setCurrentOptions([])
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
            // error={!!error}
            helperText={helperText}
            value={coarseVisibleLocStrings || value || ''}
            InputProps={TextFieldInputProps}
            placeholder="Search for location"
            onChange={e => setCurrentSearch(e.target.value)}
          />
        )
      }}
      renderOption={option => <Typography noWrap>{option.value}</Typography>}
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
