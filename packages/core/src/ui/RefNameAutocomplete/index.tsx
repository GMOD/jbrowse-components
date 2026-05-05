import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'

import { Autocomplete, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import BaseResult, { RefSequenceResult } from '../../TextSearch/BaseResults.ts'
import { measureText, useDebounce } from '../../util/index.ts'

import type { AbstractSessionModel } from '../../util/index.ts'

interface Option {
  group?: string
  result: BaseResult
}

function getFiltered(options: Option[], inputValue: string) {
  const query = inputValue.toLocaleLowerCase()
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

function getDeduplicatedResult(results: BaseResult[]) {
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
  const [loaded, setLoaded] = useState(true)
  const [currentSearch, setCurrentSearch] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [searchOptions, setSearchOptions] = useState<Option[]>()
  const debouncedSearch = useDebounce(currentSearch, 50)
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined

  const fetchResultsRef = useRef(fetchResults)
  fetchResultsRef.current = fetchResults

  // Adjust sync state during render rather than in an effect
  if (debouncedSearch === '' && (searchOptions !== undefined || !loaded)) {
    setSearchOptions(undefined)
    setLoaded(true)
  }

  useEffect(() => {
    if (!assemblyName || debouncedSearch === '') {
      return
    }
    const guard = { alive: true }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        setLoaded(false)
        const results = await fetchResultsRef.current(debouncedSearch)
        if (guard.alive) {
          setSearchOptions(getDeduplicatedResult(results))
        }
      } catch (e) {
        console.error(e)
        if (guard.alive) {
          session.notifyError(`${e}`, e)
        }
      } finally {
        if (guard.alive) {
          setLoaded(true)
        }
      }
    })()
    return () => {
      guard.alive = false
    }
  }, [assemblyName, debouncedSearch, session])

  const inputBoxVal = value ?? ''
  const regionOptions = useMemo(
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
      style={{
        ...style,
        width: Math.min(
          Math.max(measureText(inputBoxVal, 14) + 100, minWidth),
          maxWidth,
        ),
      }}
      value={inputBoxVal}
      loading={!loaded}
      inputValue={inputValue}
      onInputChange={(_event, newInputValue, reason) => {
        setInputValue(newInputValue)
        if (reason === 'input') {
          onChange?.(newInputValue)
          setCurrentSearch(newInputValue)
        }
      }}
      loadingText="loading results"
      onClose={() => {
        setLoaded(true)
        setCurrentSearch('')
        setSearchOptions(undefined)
      }}
      onChange={(_event, selectedOption) => {
        if (!selectedOption || !assemblyName) {
          return
        }
        onSelect?.(
          typeof selectedOption === 'string'
            ? new BaseResult({ label: selectedOption })
            : selectedOption.result,
        )
        setInputValue(inputBoxVal)
      }}
      options={searchOptions?.length ? searchOptions : regionOptions}
      getOptionDisabled={option => option.group === 'limitOption'}
      filterOptions={opts => getFiltered(opts, currentSearch)}
      renderInput={({ slotProps: paramSlotProps, ...restParams }) => (
        <TextField
          onBlur={() => {
            setInputValue(inputBoxVal)
          }}
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
