import React, { Suspense, lazy, useMemo, useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { getSession, useDebounce, measureText } from '@jbrowse/core/util'
import BaseResult, {
  RefSequenceResult,
} from '@jbrowse/core/TextSearch/BaseResults'
import {
  Autocomplete,
  CircularProgress,
  IconButton,
  InputAdornment,
  TextField,
  TextFieldProps as TFP,
} from '@mui/material'

// icons
import SearchIcon from '@mui/icons-material/Search'
import HelpIcon from '@mui/icons-material/Help'

// locals
import { LinearGenomeViewModel } from '..'

// lazy
const HelpDialog = lazy(() => import('./HelpDialog'))

export interface Option {
  group?: string
  result: BaseResult
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

function RefNameAutocomplete({
  model,
  onSelect,
  assemblyName,
  style,
  fetchResults,
  onChange,
  value,
  showHelp = true,
  minWidth = 200,
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
  showHelp?: boolean
  TextFieldProps?: TFP
}) {
  const session = getSession(model)
  const { assemblyManager } = session
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(true)
  const [isHelpDialogDisplayed, setHelpDialogDisplayed] = useState(false)
  const [currentSearch, setCurrentSearch] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [searchOptions, setSearchOptions] = useState<Option[]>()
  const debouncedSearch = useDebounce(currentSearch, 300)
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined
  const { coarseVisibleLocStrings, hasDisplayedRegions } = model

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
        const results = await fetchResults(debouncedSearch)
        if (active) {
          const m: { [key: string]: BaseResult[] } = {}

          for (let i = 0; i < results.length; i++) {
            const r = results[i]
            const d = r.getDisplayString()
            if (!m[d]) {
              m[d] = []
            }
            m[d].push(r)
          }
          const display = Object.entries(m).map(([displayString, results]) => {
            if (results.length === 1) {
              return { result: results[0] }
            } else {
              return {
                result: new BaseResult({
                  displayString,
                  results,
                  label: displayString,
                }),
              }
            }
          })

          setSearchOptions(display)
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
  }, [assemblyName, fetchResults, debouncedSearch, session, model])

  const inputBoxVal = coarseVisibleLocStrings || value || ''

  // heuristic, text width + icon width
  // + 45 accomodates help icon and search icon
  const width = Math.min(
    Math.max(measureText(inputBoxVal, 16) + 45, minWidth),
    550,
  )

  // notes on implementation:
  // The selectOnFocus setting helps highlight the field when clicked
  return (
    <>
      <Autocomplete
        id={`refNameAutocomplete-${model.id}`}
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
        options={!searchOptions?.length ? options : searchOptions}
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
              onBlur={() =>
                // this is used to restore a refName or the non-user-typed input
                // to the box on blurring
                setInputValue(inputBoxVal)
              }
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
                        <SearchIcon fontSize="small" />
                        {showHelp ? (
                          <IconButton
                            onClick={() => setHelpDialogDisplayed(true)}
                            size="small"
                          >
                            <HelpIcon fontSize="small" />
                          </IconButton>
                        ) : null}
                      </InputAdornment>
                    )}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
              placeholder="Search for location"
              onChange={e => setCurrentSearch(e.target.value)}
            />
          )
        }}
        getOptionLabel={option =>
          (typeof option === 'string'
            ? option
            : option.result.getDisplayString()) || ''
        }
      />
      {isHelpDialogDisplayed ? (
        <Suspense fallback={<div />}>
          <HelpDialog handleClose={() => setHelpDialogDisplayed(false)} />
        </Suspense>
      ) : null}
    </>
  )
}

export default observer(RefNameAutocomplete)
