import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

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
import type { Assembly } from '@jbrowse/core/assemblyManager/assembly'
import type { TextFieldProps as TFP } from '@mui/material'

const emptyObj = {} as const

function getOptionLabel(opt: Option | string) {
  return typeof opt === 'string' ? opt : opt.result.getDisplayString()
}

function filterOptions(opts: Option[], state: { inputValue: string }) {
  return getFiltered(opts, state.inputValue)
}

function getOptionDisabled(option: Option) {
  return option.group === 'limitOption'
}

interface MemoizedAutocompleteProps {
  assembly: Assembly | undefined
  assemblyName: string | undefined
  style: React.CSSProperties | undefined
  loaded: boolean
  open: boolean
  searchOptions: Option[] | undefined
  inputRef: React.RefObject<HTMLInputElement | null>
  TextFieldProps: TFP
  onOpen: () => void
  onClose: () => void
  onSelect: ((region: BaseResult) => void) | undefined
  onChange: ((val: string) => void) | undefined
  setCurrentSearch: (val: string) => void
}

const MemoizedAutocomplete = memo(function MemoizedAutocomplete({
  assembly,
  assemblyName,
  style,
  loaded,
  open,
  searchOptions,
  inputRef,
  TextFieldProps,
  onOpen,
  onClose,
  onSelect,
  onChange,
  setCurrentSearch,
}: MemoizedAutocompleteProps) {
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

  const handleChange = useCallback(
    (_event: unknown, selectedOption: Option | string | null) => {
      if (!selectedOption || !assemblyName) {
        return
      }

      if (typeof selectedOption === 'string') {
        onSelect?.(
          new BaseResult({
            label: selectedOption,
          }),
        )
      } else {
        onSelect?.(selectedOption.result)
      }
      inputRef.current?.blur()
    },
    [assemblyName, inputRef, onSelect],
  )

  const handleInputChange = useCallback(
    (_event: unknown, newInputValue: string) => {
      onChange?.(newInputValue)
    },
    [onChange],
  )

  const renderInput = useCallback(
    (params: Parameters<typeof AutocompleteTextField>[0]['params']) => (
      <AutocompleteTextField
        params={params}
        inputRef={inputRef}
        TextFieldProps={TextFieldProps}
        setCurrentSearch={setCurrentSearch}
      />
    ),
    [TextFieldProps, inputRef, setCurrentSearch],
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
      style={style}
      loading={!loaded}
      loadingText="loading results"
      open={open}
      onOpen={onOpen}
      onClose={onClose}
      onChange={handleChange}
      onInputChange={handleInputChange}
      options={searchOptions?.length ? searchOptions : regionOptions}
      getOptionDisabled={getOptionDisabled}
      filterOptions={filterOptions}
      renderInput={renderInput}
      getOptionLabel={getOptionLabel}
    />
  )
})

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
  TextFieldProps = emptyObj as TFP,
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
  const [searchOptions, setSearchOptions] = useState<Option[]>()
  const debouncedSearch = useDebounce(currentSearch, 50)
  const assembly = assemblyName ? assemblyManager.get(assemblyName) : undefined
  const { coarseVisibleLocStrings, hasDisplayedRegions } = model
  const inputRef = useRef<HTMLInputElement>(null)

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

  // Imperatively update input value without re-rendering the Autocomplete
  // Only update when input is not focused to avoid interfering with user typing
  // useLayoutEffect ensures value is set before browser paint
  useLayoutEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = inputBoxVal
    }
  }, [inputBoxVal])

  const handleOpen = useCallback(() => {
    setOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    setLoaded(true)
    if (hasDisplayedRegions) {
      setCurrentSearch('')
      setSearchOptions(undefined)
    }
  }, [hasDisplayedRegions])

  // Wrapper div handles dynamic width without re-rendering MemoizedAutocomplete
  return (
    <div
      style={{
        width: Math.min(
          Math.max(measureText(inputBoxVal, 14) + 100, minWidth),
          maxWidth,
        ),
      }}
    >
      <MemoizedAutocomplete
        assembly={assembly}
        assemblyName={assemblyName}
        style={style}
        loaded={loaded}
        open={open}
        searchOptions={searchOptions}
        inputRef={inputRef}
        TextFieldProps={TextFieldProps}
        onOpen={handleOpen}
        onClose={handleClose}
        onSelect={onSelect}
        onChange={onChange}
        setCurrentSearch={setCurrentSearch}
      />
    </div>
  )
})

export default RefNameAutocomplete
