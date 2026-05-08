import { useMemo, useState } from 'react'
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
  const query = inputValue.toLocaleLowerCase()
  // matchedObject is set by text-search adapters (trix, jb1) to signal that
  // the result was already filtered server-side — always include those so the
  // adapter's results aren't silently hidden by client-side filtering
  const filtered = options.filter(
    ({ result }) =>
      result.getLabel().toLowerCase().includes(query) || result.matchedObject,
  )
  return [
    ...filtered.slice(0, 100),
    ...(filtered.length > 100
      ? [
          {
            group: 'limitOption',
            result: new BaseResult({ label: 'keep typing for more results' }),
          },
        ]
      : []),
  ]
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
  const [currentSearch, setCurrentSearch] = useState('')
  const [inputValue, setInputValue] = useState('')
  const debouncedSearch = useDebounce(currentSearch, 50)
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

  const inputBoxVal = value ?? ''
  const width = Math.min(
    Math.max(
      measureText(inputBoxVal, INPUT_FONT_SIZE) + ADORNMENT_RESERVE_PX,
      minWidth,
    ),
    maxWidth,
  )
  const regionOptions: Option[] = useMemo(
    () =>
      assembly?.regions?.map(region => ({
        result: new RefSequenceResult({
          refName: region.refName,
          label: region.refName,
          displayString: region.refName,
          matchedAttribute: 'refName',
        }),
      })) ?? [],
    [assembly?.regions],
  )

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
      value={inputBoxVal}
      loading={isLoading}
      inputValue={inputValue}
      onInputChange={(_event, newInputValue, reason) => {
        if (reason === 'input') {
          setInputValue(newInputValue)
          onChange?.(newInputValue)
          setCurrentSearch(newInputValue)
        } else {
          setInputValue(inputBoxVal)
        }
      }}
      loadingText="loading results"
      onClose={() => {
        setCurrentSearch('')
      }}
      onChange={(_event, selectedOption) => {
        if (selectedOption && assemblyName) {
          onSelect?.(
            typeof selectedOption === 'string'
              ? new BaseResult({ label: selectedOption })
              : selectedOption.result,
          )
        }
      }}
      options={searchOptions?.length ? searchOptions : regionOptions}
      getOptionDisabled={option => option.group === 'limitOption'}
      filterOptions={opts => getFiltered(opts, currentSearch)}
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
