/**
 * Based on https://material-ui.com/components/autocomplete/#Virtualize.tsx
 * Asynchronous Requests for autocomplete: https://material-ui.com/components/autocomplete/
 */
import React, { useMemo, useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { Region } from '@jbrowse/core/util/types'
import { getSession, Option } from '@jbrowse/core/util'
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

// filter for options that were fetched
const filter = createFilterOptions<Option>({ trim: true, limit: 15 })

const helperSearchText = `Syntax chr1:1-100 or chr1:1..100 or {hg19}chr1:1-100 to navigate. Or search for features or names`
const useStyles = makeStyles(theme => ({
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
  onSelect: (region: string | undefined) => void
  assemblyName?: string
  value?: string
  style?: React.CSSProperties
  TextFieldProps?: TFP
}) {
  const classes = useStyles()
  const session = getSession(model)
  const { assemblyManager } = session
  const assembly = assemblyName && assemblyManager.get(assemblyName)
  const regions: Region[] = (assembly && assembly.regions) || []
  const { coarseVisibleLocStrings } = model

  const [open, setOpen] = useState(false)
  const [currentSearch, setCurrentSearch] = useState('')
  const [currentOptions, setCurrentOptions] = useState<Option[]>([])
  const [, setError] = useState<Error>()
  const loaded = regions.length !== 0 // assembly and regions have
  // const loadingSearch = currentOptions.length === 0 && currentSearch !== ''
  const options: Array<Option> = useMemo(() => {
    const defaultOptions = regions.map(option => {
      const defaultOption: Option = {
        group: 'reference sequence',
        value: option.refName,
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
          const results = await session.textSearchManager.search(
            currentSearch,
            'prefix',
          )
          if (results.length > 0) {
            setCurrentOptions(results)
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
  }, [currentSearch, session.textSearchManager])

  useEffect(() => {
    if (!open) {
      setCurrentOptions([])
    }
  }, [open])
  async function onChange(newRegionName: Option | string) {
    let newRegionValue: string | undefined
    if (newRegionName) {
      if (typeof newRegionName === 'object') {
        newRegionValue = newRegionName.value
        if (newRegionName.group === 'text search adapter') {
          const results = await session.textSearchManager.search(
            newRegionValue.toLocaleLowerCase(),
            'exact',
          )
          if (results.length > 0) {
            model.setSearchResults(results)
          }
        } else {
          onSelect(newRegionValue)
        }
      }
      if (typeof newRegionName === 'string') {
        // handles locstrings when you press enter
        newRegionValue = newRegionName
        onSelect(newRegionValue)
      }
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
        // /\w{1,}\u003A\d{1,}\u002d\d{1,}/
        // /\w+\:\d+(\.{2}|\-)\d+/

        if (params.inputValue !== '') {
          const newOption: Option = {
            group: 'Navigating to...',
            value: params.inputValue,
          }
          filtered.push(newOption)
        }
        return filtered
      }}
      ListboxProps={{ style: { maxHeight: 250 } }}
      onChange={(_, newRegion) => {
        onChange(newRegion)
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
        if (currentSearch !== '') {
          return (
            <Typography noWrap>
              <b>{option.value.slice(0, inputValue.length)}</b>
              {option.value.slice(inputValue.length)}
            </Typography>
          )
        }
        return <Typography noWrap>{option.value}</Typography>
      }}
      getOptionLabel={option => {
        // Note: needed to handle locstrings on enter
        if (typeof option === 'string') {
          return option
        }
        return option.value
      }}
    />
  )
}

export default observer(RefNameAutocomplete)
