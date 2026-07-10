import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { Autocomplete, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import {
  MAX_OPTIONS,
  cap,
  coerceToResult,
  getDeduplicatedResult,
  getFiltered,
  getInputWidth,
  getOptionLabel,
} from './util.ts'
import { RefSequenceResult } from '../../TextSearch/BaseResults.ts'
import { useDebounce, useFetch } from '../../util/index.ts'

import type { Option } from './util.ts'
import type BaseResult from '../../TextSearch/BaseResults.ts'
import type { AbstractSessionModel } from '../../util/index.ts'

const RefNameAutocomplete = observer(function RefNameAutocomplete({
  session,
  assemblyName,
  value,
  fetchResults,
  onSelect,
  onChange,
  minWidth = 200,
  maxWidth = 550,
  style,
  endAdornment,
  helperText,
  inputStyle,
}: {
  session: AbstractSessionModel
  assemblyName?: string
  // Current display value (e.g. the view's visible locstring). If absent,
  // the input shows only what the user has typed.
  value?: string
  fetchResults: (query: string) => Promise<BaseResult[]>
  onSelect?: (region: BaseResult) => void
  onChange?: (val: string) => void
  minWidth?: number
  maxWidth?: number
  style?: CSSProperties
  endAdornment?: ReactNode
  helperText?: string
  inputStyle?: CSSProperties
}) {
  const { assemblyManager } = session
  const externalValue = value ?? ''
  // MUI Autocomplete tracks `inputValue` (displayed text) separately from
  // `value` (selected item). We echo every MUI event into `inputValue` so
  // external value changes, blur snap-back, and keystrokes all stay in sync.
  const [inputValue, setInputValue] = useState(externalValue)
  // `searchQuery` drives the fetch and filter — only updated on real typing
  // so blur/reset events don't trigger phantom searches.
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearch = useDebounce(searchQuery, 50)
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined

  const shouldSearch = !!assemblyName && debouncedSearch !== ''
  const { data: searchOptions, isLoading } = useFetch(
    shouldSearch ? ['refNameSearch', assemblyName, debouncedSearch] : null,
    async () => getDeduplicatedResult(await fetchResults(debouncedSearch)),
    {
      onError: e => {
        session.notifyError(`${e}`, e)
      },
    },
  )

  const width = getInputWidth(externalValue, minWidth, maxWidth)
  // assembly.regions can hold ~10^6 refnames. This is only the browse/pre-fetch
  // fallback list (typed queries resolve through fetchResults), MUI is not
  // virtualized, and the visible list is capped at MAX_OPTIONS anyway — so only
  // materialize a bounded slice rather than a million option objects. Slicing
  // one past the cap lets `cap` still render its "keep typing" hint.
  const regionOptions: Option[] = (assembly?.regions ?? [])
    .slice(0, MAX_OPTIONS + 1)
    .map(region => ({
      result: new RefSequenceResult({
        refName: region.refName,
        label: region.refName,
      }),
    }))

  const hasSearchResults = !!searchOptions?.length

  return (
    <Autocomplete
      data-testid="autocomplete"
      disableListWrap
      disableClearable
      disabled={!assemblyName}
      freeSolo
      includeInputInList
      selectOnFocus
      clearOnBlur
      style={{ ...style, width }}
      value={externalValue}
      loading={isLoading}
      inputValue={inputValue}
      onInputChange={(_event, newInputValue, reason) => {
        setInputValue(newInputValue)
        if (reason === 'input') {
          setSearchQuery(newInputValue)
          onChange?.(newInputValue)
        } else if (reason === 'blur' || reason === 'selectOption') {
          // clear so stale results don't linger; skip 'reset' because MUI
          // fires that during its own re-render loop and clearing it kills
          // an in-flight search
          setSearchQuery('')
        }
      }}
      loadingText="loading results"
      onChange={(_event, selectedOption) => {
        if (selectedOption) {
          onSelect?.(coerceToResult(selectedOption))
          // snap back to the current loc; if navigation succeeds the parent
          // updates `value` and MUI's 'reset' event will reflect the new loc
          setInputValue(externalValue)
        }
      }}
      options={hasSearchResults ? searchOptions : regionOptions}
      getOptionDisabled={option => !!option.isLimit}
      // the two option sources are filtered against different query snapshots:
      // searchOptions are already server-filtered for `debouncedSearch` (so we
      // only cap), while regionOptions are filtered live against `searchQuery`.
      // when a fetch resolves empty, hasSearchResults flips and the list swaps
      // from search mode to region mode — both stay consistent because regions
      // re-filter by the same query
      filterOptions={opts =>
        hasSearchResults ? cap(opts) : getFiltered(opts, searchQuery)
      }
      renderInput={({ slotProps: paramSlotProps, ...restParams }) => (
        <TextField
          {...restParams}
          variant="outlined"
          size="small"
          // override global theme default (margin="dense") whose asymmetric
          // 8/4 top/bottom margins offset the input 2px downward
          margin="none"
          helperText={helperText}
          slotProps={{
            ...paramSlotProps,
            input: {
              ...paramSlotProps.input,
              style: inputStyle,
              ...(endAdornment !== undefined && { endAdornment }),
            },
          }}
          placeholder="Search for location"
        />
      )}
      getOptionLabel={getOptionLabel}
    />
  )
})

export default RefNameAutocomplete
export { default as RefNameAutocompleteEndAdornment } from './EndAdornment.tsx'
