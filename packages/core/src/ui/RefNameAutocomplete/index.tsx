import { useState } from 'react'

import { Autocomplete, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import { useDebounce } from '../../util/hooks.ts'
import { useFetch } from '../../util/useFetch.ts'
import {
  cap,
  coerceToResult,
  getDeduplicatedResult,
  getInputWidth,
  getOptionLabel,
  getRefNameOptions,
} from './util.ts'

import type BaseResult from '../../TextSearch/BaseResults.ts'
import type { AbstractSessionModel } from '../../util/index.ts'
import type { StopToken } from '../../util/stopToken.ts'
import type { CSSProperties, ReactNode } from 'react'

const RefNameAutocomplete = observer(function RefNameAutocomplete({
  session,
  assemblyName,
  value,
  fetchResults,
  onSelect,
  onChange,
  minWidth = 200,
  maxWidth = 550,
  adornmentWidth,
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
  // the stop token is stopped as soon as the next keystroke supersedes this
  // query, so a fetcher that forwards it drops the superseded work instead of
  // ranking and formatting an answer nobody will see
  fetchResults: (query: string, stopToken?: StopToken) => Promise<BaseResult[]>
  onSelect?: (region: BaseResult) => void
  onChange?: (val: string) => void
  minWidth?: number
  maxWidth?: number
  // px reserved for the endAdornment + input padding when sizing the box to the
  // value; defaults to room for the search + help icons
  adornmentWidth?: number
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
    // `as const` so the key is a fixed-arity tuple: useFetch derives the
    // fetcher's parameter list from it, and a plain array widens to a variadic
    // the named parameters below cannot be destructured out of
    shouldSearch
      ? (['refNameSearch', assemblyName, debouncedSearch] as const)
      : null,
    async (_tag, _assembly, query, stopToken) =>
      getDeduplicatedResult(await fetchResults(query, stopToken)),
    {
      onError: e => {
        session.notifyError(`${e}`, e)
      },
    },
  )

  const width = getInputWidth(externalValue, minWidth, maxWidth, adornmentWidth)
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
      // built inside the branch rather than every render: it scans the
      // assembly's regions and materializes up to the cap in option objects,
      // which is wasted work on the keystrokes that do have search results
      options={
        hasSearchResults
          ? searchOptions
          : getRefNameOptions(assembly, searchQuery)
      }
      getOptionDisabled={option => !!option.isLimit}
      // both sources arrive already matched against a query — searchOptions
      // server-side for `debouncedSearch`, regionOptions live for `searchQuery`
      // — so MUI must not re-filter them (its default filter would drop hits
      // matching on a description rather than the display string). Only cap.
      filterOptions={cap}
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
export { adornmentReservePx, getInputWidth } from './util.ts'
