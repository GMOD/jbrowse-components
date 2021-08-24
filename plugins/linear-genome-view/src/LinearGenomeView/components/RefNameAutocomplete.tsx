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
import { getSession, useDebounce } from '@jbrowse/core/util'
import TextSearchManager from '@jbrowse/core/TextSearch/TextSearchManager'
import { SearchType } from '@jbrowse/core/data_adapters/BaseAdapter'
import BaseResult, {
  RefSequenceResult,
} from '@jbrowse/core/TextSearch/BaseResults'
// material ui
import {
  TextField,
  TextFieldProps as TFP,
  CircularProgress,
  Typography,
  InputAdornment,
} from '@material-ui/core'
import SearchIcon from '@material-ui/icons/Search'
import Autocomplete from '@material-ui/lab/Autocomplete'
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

async function fetchResults(
  self: LinearGenomeViewModel,
  query: string,
  assemblyName: string,
) {
  const session = getSession(self)
  const { pluginManager } = getEnv(session)
  const { rankSearchResults } = self
  const textSearchManager: TextSearchManager =
    pluginManager.rootModel.textSearchManager
  const searchScope = self.searchScope(assemblyName)
  const args = {
    queryString: query,
    searchType: 'prefix' as SearchType,
  }
  const searchResults = await textSearchManager?.search(
    args,
    searchScope,
    rankSearchResults,
  )
  // removes duplicate search results
  return searchResults?.filter(
    (elem, index, self) =>
      index === self.findIndex(t => t.label === elem.label),
  )
}

function filterOptions(options: Option[], searchQuery: string) {
  return options.filter(option => {
    const { result } = option
    return (
      result.getLabel().toLocaleLowerCase().includes(searchQuery) ||
      result.matchedObject
    )
  })
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
  const { assemblyManager } = session
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<Error>()
  const [loaded, setLoaded] = useState<undefined | boolean>(undefined)
  const [currentSearch, setCurrentSearch] = useState('')
  const [searchOptions, setSearchOptions] = useState<Option[]>([])
  const debouncedSearch = useDebounce(currentSearch, 300)
  const { coarseVisibleLocStrings, hasDisplayedRegions } = model
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const regions: Region[] = assembly?.regions || []

  const options: Option[] = useMemo(
    () =>
      regions.map(option => ({
        result: new RefSequenceResult({
          refName: option.refName,
          label: option.refName,
          matchedAttribute: 'refName',
        }),
      })),
    [regions],
  )

  useEffect(() => {
    let active = true

    ;(async () => {
      try {
        let results: BaseResult[] = []
        if (debouncedSearch && debouncedSearch !== '' && assemblyName) {
          setLoaded(false)
          const searchResults = await fetchResults(
            model,
            debouncedSearch,
            assemblyName,
          )
          results = results.concat(searchResults)
        }
        if (results.length >= 0 && active) {
          const adapterResults: Option[] = results.map(result => {
            return { result }
          })
          setSearchOptions(adapterResults)
        }
        setLoaded(true)
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
    <>
      <Autocomplete
        id={`refNameAutocomplete-${model.id}`}
        data-testid="autocomplete"
        clearOnBlur
        disableListWrap
        disableClearable
        disabled={!!error || !assemblyName}
        freeSolo
        includeInputInList
        selectOnFocus
        style={style}
        value={coarseVisibleLocStrings || value || ''}
        loading={loaded !== undefined ? !loaded : false}
        loadingText="loading results"
        open={open}
        onOpen={() => {
          setOpen(true)
        }}
        onClose={() => {
          setOpen(false)
          setLoaded(undefined)
          if (hasDisplayedRegions) {
            setCurrentSearch('')
            setSearchOptions([])
          }
        }}
        onChange={(_, selectedOption) => onChange(selectedOption)}
        options={searchOptions.length === 0 ? options : searchOptions}
        getOptionDisabled={option => option?.group === 'limitOption'}
        filterOptions={(options, params) => {
          const searchQuery = params.inputValue.toLocaleLowerCase()
          const filtered = filterOptions(options, searchQuery)
          return filtered.length >= 100
            ? filtered.slice(0, 100).concat([
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
        renderInput={params => {
          const { helperText, InputProps = {} } = TextFieldProps
          const TextFieldInputProps = {
            ...params.InputProps,
            ...InputProps,
            endAdornment: (
              <>
                {regions.length === 0 ? (
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
          const component = result.getRenderingComponent()
          if (component) {
            if (React.isValidElement(component)) {
              return component
            }
          }
          return <Typography noWrap>{result.getLabel()}</Typography>
        }}
        getOptionLabel={option => {
          // needed for filtering options and value
          return (
            (typeof option === 'string' ? option : option.result.getLabel()) ||
            ''
          )
        }}
      />{' '}
      {error ? (
        <Typography variant="h6" color="error">{`${error}`}</Typography>
      ) : null}
    </>
  )
}

export default observer(RefNameAutocomplete)
