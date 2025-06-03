import { useEffect, useMemo, useState } from 'react'

import BaseResult, {
  RefSequenceResult,
} from '@jbrowse/core/TextSearch/BaseResults'
import { getSession, measureText, useDebounce } from '@jbrowse/core/util'
import { Autocomplete } from '@mui/material'
import { observer } from 'mobx-react'

import AutocompleteTextField from './AutocompleteTextField'
import { getDeduplicatedResult, getFiltered } from './util'

import type { Option } from './util'
import type { LinearGenomeViewModel } from '../../model'
import type { TextFieldProps as TFP } from '@mui/material'

const RefNameAutocomplete = observer(function ({
  model,
  onSelect,
  assemblyName,
  style,
  fetchResults,
  onChange,
  value,
  minWidth = 200,
  maxWidth = 550,
  TextFieldProps = {},
}: {
  model: LinearGenomeViewModel
  onSelect?: (region: BaseResult) => void
  onChange?: (val: string) => void
  assemblyName?: string
  value?: string
  fetchResults: (query: string) => Promise<BaseResult[]>
  style?: React.CSSProperties
  minWidth?: number
  maxWidth?: number
  TextFieldProps?: TFP
}) {
  const session = getSession(model)
  const { assemblyManager } = session
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(true)
  const [currentSearch, setCurrentSearch] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [searchOptions, setSearchOptions] = useState<Option[]>()
  const debouncedSearch = useDebounce(currentSearch, 50)
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined
  const { coarseVisibleLocStrings, hasDisplayedRegions } = model

  // this callback runs an async search. the typescript code claims that
  useEffect(() => {
    const isCurrent = { cancelled: false }
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        if (debouncedSearch === '' || !assemblyName) {
          return
        }

        setLoaded(false)
        const results = await fetchResults(debouncedSearch)

        if (!isCurrent.cancelled) {
          setSearchOptions(getDeduplicatedResult(results))
        }
      } catch (e) {
        console.error(e)
        if (!isCurrent.cancelled) {
          session.notifyError(`${e}`, e)
        }
      } finally {
        if (!isCurrent.cancelled) {
          setLoaded(true)
        }
      }
    })()

    return () => {
      isCurrent.cancelled = true
    }
  }, [assemblyName, fetchResults, debouncedSearch, session])
  const inputBoxVal = coarseVisibleLocStrings || value || ''

  const regions = assembly?.regions
  const regionOptions = useMemo(
    () =>
      regions?.map(region => ({
        result: new RefSequenceResult({
          refName: region.refName,
          label: region.refName,
          displayString: region.refName,
          matchedAttribute: 'refName',
        }),
      })) || [],
    [regions],
  )

  // notes on implementation:
  // The selectOnFocus setting helps highlight the field when clicked
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
      onInputChange={(_event, newInputValue) => {
        setInputValue(newInputValue)
        onChange?.(newInputValue)
      }}
      loadingText="loading results"
      open={open}
      onOpen={() => {
        setOpen(true)
      }}
      onClose={() => {
        setOpen(false)
        setLoaded(true)
        if (hasDisplayedRegions) {
          setCurrentSearch('')
          setSearchOptions(undefined)
        }
      }}
      onChange={(_event, selectedOption) => {
        if (!selectedOption || !assemblyName) {
          return
        }

        if (typeof selectedOption === 'string') {
          // handles string inputs on keyPress enter
          onSelect?.(
            new BaseResult({
              label: selectedOption,
            }),
          )
        } else {
          onSelect?.(selectedOption.result)
        }
        setInputValue(inputBoxVal)
      }}
      options={searchOptions?.length ? searchOptions : regionOptions}
      getOptionDisabled={option => option.group === 'limitOption'}
      filterOptions={(opts, { inputValue }) => getFiltered(opts, inputValue)}
      renderInput={params => (
        <AutocompleteTextField
          params={params}
          inputBoxVal={inputBoxVal}
          TextFieldProps={TextFieldProps}
          setCurrentSearch={setCurrentSearch}
          setInputValue={setInputValue}
        />
      )}
      getOptionLabel={opt =>
        typeof opt === 'string' ? opt : opt.result.getDisplayString()
      }
    />
  )
})

export default RefNameAutocomplete
