/**
 * Based on:
 *  https://material-ui.com/components/autocomplete/#Virtualize.tsx
 * Asynchronous Requests for autocomplete:
 *  https://material-ui.com/components/autocomplete/
 */
import React, { useMemo, useEffect, useState } from 'react'
import { observer } from 'mobx-react'
// jbrowse core
import { Region } from '@jbrowse/core/util/types'
import { getSession } from '@jbrowse/core/util'
import BaseResult, {
  LocationResult,
  RefSequenceResult,
} from '@jbrowse/core/TextSearch/BaseResults'
// material ui
import CircularProgress from '@material-ui/core/CircularProgress'
import TextField, { TextFieldProps as TFP } from '@material-ui/core/TextField'
import Tooltip from '@material-ui/core/Tooltip'
import Typography from '@material-ui/core/Typography'
import SearchIcon from '@material-ui/icons/Search'
import { InputAdornment } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'
import Autocomplete, {
  createFilterOptions,
} from '@material-ui/lab/Autocomplete'
// other
import { LinearGenomeViewModel } from '..'

/**
 *  Option interface used to format results to display in dropdown
 *  of the materila ui interface
 */
export interface Option {
  group: string
  result: BaseResult
  inputValue?: string
}

// filters for options to display in dropdown
const filter = createFilterOptions<Option>({
  trim: true,
  limit: 15,
  matchFrom: 'start',
})
const helperSearchText = `Navigate to a specific location by using syntax [chr1:1-100 or chr1:1..100]. Or search for features or names`
const useStyles = makeStyles(() => ({
  customWidth: {
    maxWidth: 150,
  },
}))

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
  const classes = useStyles()
  const session = getSession(model)
  const { assemblyManager, textSearchManager } = session
  const assembly = assemblyName && assemblyManager.get(assemblyName)
  const regions: Region[] = (assembly && assembly.regions) || []
  const loaded = regions.length !== 0 // assembly and regions have loaded
  const { coarseVisibleLocStrings } = model

  // state
  const [open, setOpen] = useState(false)
  const [currentSearch, setCurrentSearch] = useState('')
  const [currentOptions, setCurrentOptions] = useState<Option[]>([])
  const [, setError] = useState<Error>()

  // const loadingSearch = currentOptions.length === 0 && currentSearch !== ''
  const options: Array<Option> = useMemo(() => {
    const defaultOptions = regions.map(option => {
      const defaultOption: Option = {
        group: 'reference sequence',
        result: new RefSequenceResult({
          refName: option.refName,
          rendering: option.refName,
        }),
      }
      return defaultOption
    })
    return defaultOptions.concat(currentOptions)
  }, [regions, currentOptions])

  useEffect(() => {
    let active = true
    if (active) {
      ;(async () => {
        try {
          if (currentSearch !== '') {
            const results: BaseResult[] = await textSearchManager.search({
              queryString: currentSearch,
              searchType: 'prefix',
            })
            if (results.length > 0) {
              const adapterResults: Option[] = results.map(result => {
                const newOption: Option = {
                  group: 'text search adapter',
                  result,
                }
                return newOption
              })
              setCurrentOptions(adapterResults)
            }
          }
        } catch (e) {
          console.error(e)
          if (active) {
            setError(e)
          }
        }
      })()
    }
    return () => {
      active = false
      setError(undefined)
    }
  }, [currentSearch])

  useEffect(() => {
    if (!open) {
      setCurrentOptions([])
    }
  }, [open])

  function onChange(selectedOption: Option | string) {
    let newRegionValue: BaseResult | undefined
    if (selectedOption) {
      if (typeof selectedOption === 'object') {
        newRegionValue = selectedOption.result
      }
      if (typeof selectedOption === 'string') {
        // handles locstrings when you press enter
        newRegionValue = new LocationResult({
          rendering: selectedOption,
          location: selectedOption,
        })
      }
      newRegionValue && onSelect(newRegionValue)
    }
  }

  return (
    <Autocomplete
      id={`refNameAutocomplete-${model.id}`}
      data-testid="autocomplete"
      freeSolo // needed for locstring navigation on enter
      disableListWrap
      disableClearable
      includeInputInList
      clearOnBlur
      selectOnFocus // used to select the user input or highlight the locstring default value
      disabled={!assemblyName || !loaded} // needs to have assembly set and default options
      loading={loaded}
      loadingText="Loading results..." // used for when we fetch results
      style={style}
      value={coarseVisibleLocStrings || value || ''} // defaults to visible locstring
      open={open}
      onOpen={() => {
        setOpen(true)
      }}
      onClose={() => {
        setOpen(false)
      }}
      options={options}
      groupBy={option => String(option.group)}
      filterOptions={(possibleOptions, params) => {
        const filtered = filter(possibleOptions, params)
        // creates new option if user input does not match options
        if (params.inputValue !== '') {
          const newOption: Option = {
            group: 'Navigating to...',
            result: new LocationResult({
              rendering: params.inputValue,
              location: params.inputValue,
            }),
            inputValue: params.inputValue,
          }
          filtered.push(newOption)
        }
        return filtered
      }}
      ListboxProps={{ style: { maxHeight: 250 } }}
      onChange={(_, selectedOption) => {
        onChange(selectedOption)
      }}
      renderInput={params => {
        const { helperText, InputProps = {} } = TextFieldProps
        const TextFieldInputProps = {
          ...params.InputProps,
          ...InputProps,
          endAdornment: (
            <>
              {!loaded ? ( // TODO: add condition for when fetching for new search results
                <CircularProgress color="inherit" size={20} />
              ) : (
                <Tooltip
                  title={helperSearchText}
                  leaveDelay={300}
                  placement="top"
                  classes={{ tooltip: classes.customWidth }}
                >
                  <InputAdornment position="end" style={{ marginRight: 7 }}>
                    <SearchIcon />
                  </InputAdornment>
                </Tooltip>
              )}
              {params.InputProps.endAdornment}
            </>
          ),
        }
        return (
          <TextField
            {...params}
            {...TextFieldProps}
            helperText={helperText}
            value={coarseVisibleLocStrings || value || ''}
            InputProps={TextFieldInputProps}
            placeholder="Search for location"
            onChange={e => setCurrentSearch(e.target.value.toLocaleLowerCase())}
          />
        )
      }}
      renderOption={(option, { inputValue }) => {
        // TODO fix when matched string is not at the beginning
        const { result } = option
        if (currentSearch !== '') {
          const val = option.inputValue || result?.getRendering() || ''
          return (
            <Typography noWrap>
              <b>{val.slice(0, inputValue.length)}</b>
              {val.slice(inputValue.length)}
            </Typography>
          )
        }
        return (
          <Typography noWrap>
            {option.inputValue || result.getRendering() || ''}
          </Typography>
        )
      }}
      getOptionLabel={option => {
        // Note: needed to handle locstrings on enter
        if (typeof option === 'string') {
          return option
        }
        return option.inputValue || option?.result.getRendering() || ''
      }}
    />
  )
}

export default observer(RefNameAutocomplete)
