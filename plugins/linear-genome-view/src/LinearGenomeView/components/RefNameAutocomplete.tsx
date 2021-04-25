/**
 * Based on:
 *  https://material-ui.com/components/autocomplete/#Virtualize.tsx
 * Asynchronous Requests for autocomplete:
 *  https://material-ui.com/components/autocomplete/
 */
import React, { useMemo, useEffect, useState } from 'react'
import { observer } from 'mobx-react'
// jbrowse core
import { Region } from '@jbrowse/core/util/types'
import { getSession, useDebounce } from '@jbrowse/core/util'
import BaseResult, {
  LocationResult,
  RefSequenceResult,
} from '@jbrowse/core/TextSearch/BaseResults'
// material ui
import CircularProgress from '@material-ui/core/CircularProgress'
import TextField, { TextFieldProps as TFP } from '@material-ui/core/TextField'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import SearchIcon from '@material-ui/icons/Search'
import { InputAdornment } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import Autocomplete, {
  createFilterOptions,
} from '@material-ui/lab/Autocomplete'
// other
import { LinearGenomeViewModel } from '..'

/**
 *  Option interface used to format results to display in dropdown
 *  of the materila ui interface
 */
export interface Option {
  group: string
  result: BaseResult
}

// filters for options to display in dropdown
const filter = createFilterOptions<Option>({
  trim: true,
  limit: 15,
  matchFrom: 'start',
})
const helperSearchText = `Search for features or navigate to a location using syntax "chr1:1-100" or "chr1:1..100"`
const useStyles = makeStyles(() => ({
  customWidth: {
    maxWidth: 150,
  },
}))

function RefNameAutocomplete({
  model,
  onSelect,
  assemblyName,
  style,
  value,
  TextFieldProps = {},
}: {
  model: LinearGenomeViewModel
  onSelect: (region: BaseResult) => void
  assemblyName?: string
  value?: string
  style?: React.CSSProperties
  TextFieldProps?: TFP
}) {
  const classes = useStyles()
  const session = getSession(model)

  const [open, setOpen] = useState(false)
  const [, setError] = useState<Error>()
  const [currentSearch, setCurrentSearch] = useState('')
  const debouncedSearch = useDebounce(currentSearch, 350)

  const [searchOptions, setSearchOptions] = useState<Option[]>([])
  const { assemblyManager, textSearchManager } = session
  const { coarseVisibleLocStrings } = model
  const assembly = assemblyName && assemblyManager.get(assemblyName)
  const regions: Region[] = (assembly && assembly.regions) || []
  // default options for dropdown
  const options: Array<Option> = useMemo(() => {
    const defaultOptions = regions.map(option => {
      const defaultOption: Option = {
        group: 'reference sequence',
        result: new RefSequenceResult({
          refName: option.refName,
          rendering: option.refName,
        }),
      }
      return defaultOption
    })
    return defaultOptions
  }, [regions])
  // assembly and regions have loaded
  const loaded = regions.length !== 0 && options.length !== 0

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        let results: BaseResult[] = []
        if (debouncedSearch && debouncedSearch !== '') {
          results = await textSearchManager.search({
            queryString: debouncedSearch,
            searchType: 'exact',
          })
        } else if (currentSearch !== '') {
          results = await textSearchManager.search({
            queryString: currentSearch,
            searchType: 'prefix',
          })
        }
        if (results.length > 0 && active) {
          const adapterResults: Option[] = results.map(result => {
            const newOption: Option = {
              group: 'text search adapter',
              result,
            }
            return newOption
          })
          setSearchOptions(adapterResults)
        }
      } catch (e) {
        console.error(e)
        if (active) {
          setError(e)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [currentSearch, debouncedSearch])

  function onChange(selectedOption: Option | string) {
    if (selectedOption) {
      if (typeof selectedOption === 'string') {
        // handles string inputs on keyPress enter
        const newResult = new LocationResult({
          rendering: selectedOption,
          location: selectedOption,
        })
        onSelect(newResult)
      } else {
        const { result } = selectedOption
        onSelect(result)
      }
    }
  }

  return (
    <Autocomplete
      id={`refNameAutocomplete-${model.id}`}
      data-testid="autocomplete"
      freeSolo
      disableListWrap
      disableClearable
      includeInputInList
      clearOnBlur
      selectOnFocus
      disabled={!assemblyName || !loaded}
      loading={loaded}
      loadingText="Loading..."
      style={style}
      value={coarseVisibleLocStrings || value || ''}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => {
        setOpen(false)
        setSearchOptions([])
      }}
      options={options.concat(searchOptions)}
      groupBy={option => String(option.group)}
      filterOptions={(possibleOptions, params) => {
        const filtered = filter(possibleOptions, params)
        // creates a new location option as user types
        if (params.inputValue !== '') {
          const newOption: Option = {
            group: 'Navigating to...',
            result: new LocationResult({
              rendering: params.inputValue,
              location: params.inputValue,
            }),
          }
          filtered.push(newOption)
        }
        return filtered
      }}
      ListboxProps={{ style: { maxHeight: 250 } }}
      onChange={(_, selectedOption) => onChange(selectedOption)}
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
                <Tooltip
                  title={helperSearchText}
                  leaveDelay={300}
                  placement="top"
                  classes={{ tooltip: classes.customWidth }}
                >
                  <InputAdornment position="end" style={{ marginRight: 7 }}>
                    <SearchIcon />
                  </InputAdornment>
                </Tooltip>
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
            onChange={e => setCurrentSearch(e.target.value.toLocaleLowerCase())}
          />
        )
      }}
      renderOption={(option, { inputValue }) => {
        const { result } = option
        const val = result.getRendering()
        if (currentSearch !== '' && inputValue.length <= val.length) {
          return (
            <Typography noWrap>
              <b>{val.slice(0, inputValue.length)}</b>
              {val.slice(inputValue.length)}
            </Typography>
          )
        }
        return <Typography noWrap>{val}</Typography>
      }}
      getOptionLabel={option => {
        // needed for filtering options and value
        return typeof option === 'string'
          ? option
          : option.result.getRendering()
      }}
    />
  )
}

export default observer(RefNameAutocomplete)
