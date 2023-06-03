import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { getSession, useDebounce, measureText } from '@jbrowse/core/util'
import BaseResult, {
  RefSequenceResult,
} from '@jbrowse/core/TextSearch/BaseResults'
import { Autocomplete, TextFieldProps as TFP } from '@mui/material'

// locals
import { LinearGenomeViewModel } from '../../model'
import { getDeduplicatedResult, getFiltered, Option } from './util'
import AutocompleteTextField from './AutocompleteTextField'

export default observer(function RefNameAutocomplete({
  model,
  onSelect,
  assemblyName,
  style,
  fetchResults,
  onChange,
  value,
  showHelp = true,
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
  showHelp?: boolean
  TextFieldProps?: TFP
}) {
  const session = getSession(model)
  const { assemblyManager } = session
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(true)
  const [currentSearch, setCurrentSearch] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [searchOptions, setSearchOptions] = useState<Option[]>()
  const debouncedSearch = useDebounce(currentSearch, 300)
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined
  const { coarseVisibleLocStrings, hasDisplayedRegions } = model

  useEffect(() => {
    let active = true

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      try {
        if (debouncedSearch === '' || !assemblyName) {
          return
        }

        setLoaded(false)
        const results = await fetchResults(debouncedSearch)
        if (active) {
          setLoaded(true)
          setSearchOptions(getDeduplicatedResult(results))
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
  }, [assemblyName, fetchResults, debouncedSearch, session, model])

  const inputBoxVal = coarseVisibleLocStrings || value || ''

  // heuristic, text width + 60 accommodates help icon and search icon
  const width = Math.min(
    Math.max(measureText(inputBoxVal, 14) + 100, minWidth),
    maxWidth,
  )

  // notes on implementation:
  // The selectOnFocus setting helps highlight the field when clicked
  return (
    <>
      <Autocomplete
        data-testid="autocomplete"
        disableListWrap
        disableClearable
        disabled={!assemblyName}
        freeSolo
        includeInputInList
        selectOnFocus
        style={{ ...style, width }}
        value={inputBoxVal}
        loading={!loaded}
        inputValue={inputValue}
        onInputChange={(_event, newInputValue) => {
          setInputValue(newInputValue)
          onChange?.(newInputValue)
        }}
        loadingText="loading results"
        open={open}
        onOpen={() => setOpen(true)}
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
            onSelect?.(new BaseResult({ label: selectedOption }))
          } else {
            onSelect?.(selectedOption.result)
          }
          setInputValue(inputBoxVal)
        }}
        options={
          !searchOptions?.length
            ? assembly?.regions?.map(option => ({
                result: new RefSequenceResult({
                  refName: option.refName,
                  label: option.refName,
                  matchedAttribute: 'refName',
                }),
              })) || []
            : searchOptions
        }
        getOptionDisabled={option => option.group === 'limitOption'}
        filterOptions={(opts, { inputValue }) => getFiltered(opts, inputValue)}
        renderInput={params => (
          <AutocompleteTextField
            showHelp={showHelp}
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
    </>
  )
})
