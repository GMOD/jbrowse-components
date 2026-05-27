import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { Autocomplete, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import BaseResult, { RefSequenceResult } from '../../TextSearch/BaseResults.ts'
import { measureText, useDebounce, useFetch } from '../../util/index.ts'

import type { AbstractSessionModel } from '../../util/index.ts'

// matches the rendered font-size of the TextField
const INPUT_FONT_SIZE = 14
// reserve room for the search/help icons and input padding
const ADORNMENT_RESERVE_PX = 100

interface Option {
  group?: string
  result: BaseResult
}

function getFiltered(options: Option[], inputValue: string) {
  const query = inputValue.toLowerCase()
  const filtered = options.filter(({ result }) =>
    result.getLabel().toLowerCase().includes(query),
  )
  return filtered.length > 100
    ? [
        ...filtered.slice(0, 100),
        {
          group: 'limitOption',
          result: new BaseResult({ label: 'keep typing for more results' }),
        },
      ]
    : filtered
}

function getDeduplicatedResult(results: BaseResult[]): Option[] {
  const m: Record<string, BaseResult[]> = {}
  for (const result of results) {
    const key = result.getDisplayString()
    ;(m[key] ??= []).push(result)
  }
  return Object.entries(m).map(([displayString, results]) =>
    results.length === 1
      ? { result: results[0]! }
      : {
          result: new BaseResult({
            displayString,
            results,
            label: displayString,
          }),
        },
  )
}

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

  const width = Math.min(
    Math.max(
      measureText(externalValue, INPUT_FONT_SIZE) + ADORNMENT_RESERVE_PX,
      minWidth,
    ),
    maxWidth,
  )
  const regionOptions: Option[] =
    assembly?.regions?.map(region => ({
      result: new RefSequenceResult({
        refName: region.refName,
        label: region.refName,
      }),
    })) ?? []

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
          onSelect?.(
            typeof selectedOption === 'string'
              ? new BaseResult({ label: selectedOption })
              : selectedOption.result,
          )
          // snap back to the current loc; if navigation succeeds the parent
          // updates `value` and MUI's 'reset' event will reflect the new loc
          setInputValue(externalValue)
        }
      }}
      options={searchOptions?.length ? searchOptions : regionOptions}
      getOptionDisabled={option => option.group === 'limitOption'}
      filterOptions={opts =>
        searchOptions?.length ? opts : getFiltered(opts, searchQuery)
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
      getOptionLabel={opt =>
        typeof opt === 'string' ? opt : opt.result.getDisplayString()
      }
    />
  )
})

export default RefNameAutocomplete
export { default as RefNameAutocompleteEndAdornment } from './EndAdornment.tsx'
