/**
 * Based on:
 *  https://material-ui.com/components/autocomplete/#Virtualize.tsx
 * Asynchronous Requests for autocomplete:
 *  https://material-ui.com/components/autocomplete/
 */
import React, { useMemo, useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'

// jbrowse core
import { Region } from '@jbrowse/core/util/types'
import { getSession, useDebounce } from '@jbrowse/core/util' // useDebounce
import BaseResult, {
  RefSequenceResult,
} from '@jbrowse/core/TextSearch/BaseResults'
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

/**
 *  Option interface used to format results to display in dropdown
 *  of the materila ui interface
 */
export interface Option {
  group?: string
  result: BaseResult
}

// filters for options to display in dropdown
const filter = createFilterOptions<Option>({
  trim: true,
  ignoreCase: true,
  limit: 100,
})

async function fetchResults(
  self: LinearGenomeViewModel,
  query: string,
  assemblyName: string,
) {
  const session = getSession(self)
  const { pluginManager } = getEnv(session)
  const { rankSearchResults } = self
  const { textSearchManager } = pluginManager.rootModel
  const searchScope = self.searchScope(assemblyName)
  const args = {
    queryString: query,
    searchType: 'prefix',
  }
  const searchResults =
    (await textSearchManager?.search(args, searchScope, rankSearchResults)) ||
    []
  return searchResults
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
  onSelect: (region: BaseResult) => void
  assemblyName?: string
  value?: string
  style?: React.CSSProperties
  TextFieldProps?: TFP
}) {
  const session = getSession(model)
  const [open, setOpen] = useState(false)
  const [, setError] = useState<Error>()
  const [currentSearch, setCurrentSearch] = useState('')
  const debouncedSearch = useDebounce(currentSearch, 300)
  const [searchOptions, setSearchOptions] = useState<Option[]>([])
  const { assemblyManager } = session
  const { coarseVisibleLocStrings } = model
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const regions: Region[] = assembly?.regions || []

  const options: Option[] = useMemo(() => {
    const defaultOptions = regions.map(option => {
      return {
        result: new RefSequenceResult({
          refName: option.refName,
          label: option.refName,
          matchedAttribute: 'refName',
        }),
      }
    })
    return defaultOptions
  }, [regions])

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        let results: BaseResult[] = []
        if (debouncedSearch && debouncedSearch !== '' && assemblyName) {
          const searchResults = await fetchResults(
            model,
            debouncedSearch,
            assemblyName,
          )
          results = results.concat(searchResults)
        }
        if (results.length > 0 && active) {
          const adapterResults: Option[] = results.map(result => {
            return { result }
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
  }, [assemblyName, debouncedSearch, model])

  function onChange(selectedOption: Option | string) {
    if (selectedOption && assemblyName) {
      if (typeof selectedOption === 'string') {
        // handles string inputs on keyPress enter
        const newResult = new BaseResult({
          label: selectedOption,
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
      disabled={!assemblyName}
      style={style}
      value={coarseVisibleLocStrings || value || ''}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => {
        setOpen(false)
        setCurrentSearch('')
        setSearchOptions([])
      }}
      options={searchOptions.length === 0 ? options : searchOptions}
      getOptionDisabled={option => option?.group === 'limitOption'}
      filterOptions={(possibleOptions, params) => {
        const filtered = filter(possibleOptions, params)
        return filtered.length >= 100
          ? filtered.concat([
              {
                group: 'limitOption',
                result: new BaseResult({
                  label: 'keep typing for more results',
                  renderingComponent: (
                    <Typography>{'keep typing for more results'}</Typography>
                  ),
                }),
              },
            ])
          : filtered
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
              {regions.length === 0 && searchOptions.length === 0 ? (
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
            onChange={e => {
              setCurrentSearch(e.target.value)
            }}
          />
        )
      }}
      renderOption={option => {
        const { result } = option
        const rendering = result.getLabel()
        // if renderingComponent is provided render that
        const component = result.getRenderingComponent()
        if (component) {
          if (React.isValidElement(component)) {
            return component
          }
        }
        return <Typography noWrap>{rendering}</Typography>
      }}
      getOptionLabel={option => {
        // needed for filtering options and value
        return (
          (typeof option === 'string' ? option : option.result.getLabel()) || ''
        )
      }}
    />
  )
}

export default observer(RefNameAutocomplete)
