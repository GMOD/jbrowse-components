import React, { useMemo, useEffect, useState } from 'react'
import { observer } from 'mobx-react'

// jbrowse core
import { getSession, useDebounce, measureText } from '@jbrowse/core/util'
import BaseResult, {
  RefSequenceResult,
} from '@jbrowse/core/TextSearch/BaseResults'

// material ui
import {
  CircularProgress,
  InputAdornment,
  Popper,
  TextField,
  TextFieldProps as TFP,
  PopperProps,
  Typography,
} from '@material-ui/core'
import SearchIcon from '@material-ui/icons/Search'
import Autocomplete from '@material-ui/lab/Autocomplete'

// locals
import { LinearGenomeViewModel } from '..'

export interface Option {
  group?: string
  result: BaseResult
}

async function fetchResults(
  self: LinearGenomeViewModel,
  query: string,
  assemblyName: string,
) {
  const { textSearchManager } = getSession(self)
  const { rankSearchResults } = self
  const searchScope = self.searchScope(assemblyName)
  return textSearchManager
    ?.search(
      {
        queryString: query,
        searchType: 'prefix',
      },
      searchScope,
      rankSearchResults,
    )
    .then(results =>
      results.filter(
        (elem, index, self) =>
          index === self.findIndex(t => t.label === elem.label),
      ),
    )
}

// the logic of this method is to only apply a filter to RefSequenceResults
// because they do not have a matchedObject. the trix search results already
// filter so don't need re-filtering
function filterOptions(options: Option[], searchQuery: string) {
  return options.filter(option => {
    const { result } = option
    return (
      result.getLabel().toLowerCase().includes(searchQuery) ||
      result.matchedObject
    )
  })
}

// MyPopper used to expand search results box wider if needed
// xref https://stackoverflow.com/a/63583835/2129219
const MyPopper = function (
  props: PopperProps & { style?: { width?: unknown } },
) {
  const { style } = props
  return (
    <Popper
      {...props}
      style={{
        width: 'fit-content',
        minWidth: Math.min(+(style?.width || 0), 200),
        background: 'white',
      }}
      placement="bottom-start"
    />
  )
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
  const [loaded, setLoaded] = useState(true)
  const [currentSearch, setCurrentSearch] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [searchOptions, setSearchOptions] = useState([] as Option[])
  const debouncedSearch = useDebounce(currentSearch, 300)
  const { coarseVisibleLocStrings, hasDisplayedRegions } = model
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const regions = assembly?.regions || []

  const options = useMemo(
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
        if (debouncedSearch === '' || !assemblyName) {
          return
        }

        setLoaded(false)
        const results = await fetchResults(model, debouncedSearch, assemblyName)
        if (active) {
          if (results && results.length >= 0) {
            setSearchOptions(results.map(result => ({ result })))
          }
          setLoaded(true)
        }
      } catch (e) {
        console.error(e)
        if (active) {
          session.notify(`${e}`, 'error')
        }
      }
    })()

    return () => {
      active = false
    }
  }, [assemblyName, debouncedSearch, session, model])

  const inputBoxVal = coarseVisibleLocStrings || value || ''

  // heuristic, text width + icon width, minimum 200
  const width = Math.min(Math.max(measureText(inputBoxVal, 16) + 25, 200), 550)

  // notes on implementation:
  // The selectOnFocus setting helps highlight the field when clicked
  return (
    <Autocomplete
      id={`refNameAutocomplete-${model.id}`}
      data-testid="autocomplete"
      disableListWrap
      disableClearable
      PopperComponent={MyPopper}
      disabled={!assemblyName}
      freeSolo
      includeInputInList
      selectOnFocus
      style={{ ...style, width }}
      value={inputBoxVal}
      loading={!loaded}
      inputValue={inputValue}
      onInputChange={(event, newInputValue) => setInputValue(newInputValue)}
      loadingText="loading results"
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => {
        setOpen(false)
        setLoaded(true)
        if (hasDisplayedRegions) {
          setCurrentSearch('')
          setSearchOptions([])
        }
      }}
      onChange={(_event, selectedOption) => {
        if (!selectedOption || !assemblyName) {
          return
        }

        if (typeof selectedOption === 'string') {
          // handles string inputs on keyPress enter
          onSelect(new BaseResult({ label: selectedOption }))
        } else {
          onSelect(selectedOption.result)
        }
        setInputValue(inputBoxVal)
      }}
      options={searchOptions.length === 0 ? options : searchOptions}
      getOptionDisabled={option => option?.group === 'limitOption'}
      filterOptions={(options, params) => {
        const filtered = filterOptions(
          options,
          params.inputValue.toLocaleLowerCase(),
        )
        return [
          ...filtered.slice(0, 100),
          ...(filtered.length > 100
            ? [
                {
                  group: 'limitOption',
                  result: new BaseResult({
                    label: 'keep typing for more results',
                  }),
                },
              ]
            : []),
        ]
      }}
      renderInput={params => {
        const { helperText, InputProps = {} } = TextFieldProps
        return (
          <TextField
            onBlur={() => {
              // this is used to restore a refName or the non-user-typed input
              // to the box on blurring
              setInputValue(inputBoxVal)
            }}
            {...params}
            {...TextFieldProps}
            helperText={helperText}
            InputProps={{
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
            }}
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
        if (component && React.isValidElement(component)) {
          return component
        }

        return <Typography noWrap>{result.getDisplayString()}</Typography>
      }}
      getOptionLabel={option =>
        (typeof option === 'string' ? option : option.result.getLabel()) || ''
      }
    />
  )
}

export default observer(RefNameAutocomplete)
