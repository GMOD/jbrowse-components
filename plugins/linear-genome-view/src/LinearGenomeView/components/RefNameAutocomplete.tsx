/**
 * Based on https://material-ui.com/components/autocomplete/#Virtualize.tsx
 * Asynchronous Requests for autocomplete: https://material-ui.com/components/autocomplete/
 */
import { Region } from '@jbrowse/core/util/types'
import { getSession } from '@jbrowse/core/util'
import CircularProgress from '@material-ui/core/CircularProgress'
import ListSubheader from '@material-ui/core/ListSubheader'
import TextField, { TextFieldProps as TFP } from '@material-ui/core/TextField'
// import Typography from '@material-ui/core/Typography'
import Autocomplete, {
  createFilterOptions,
} from '@material-ui/lab/Autocomplete'
// import SearchIcon from '@material-ui/icons/Search'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import React, { useEffect } from 'react'
import { ListChildComponentProps, VariableSizeList } from 'react-window'
import { LinearGenomeViewModel } from '..'

// filter for options that were fetched
const filter = createFilterOptions({ trim: true, limit: 30 })

function renderRow(props: ListChildComponentProps) {
  const { data, index, style } = props
  return React.cloneElement(data[index], {
    style: {
      ...style,
    },
  })
}

const OuterElementContext = React.createContext({})

const OuterElementType = React.forwardRef<HTMLDivElement>((props, ref) => {
  const outerProps = React.useContext(OuterElementContext)
  return <div ref={ref} {...props} {...outerProps} />
})

// Adapter for react-window
const ListboxComponent = React.forwardRef<HTMLDivElement>(
  function ListboxComponent(props, ref) {
    // eslint-disable-next-line react/prop-types
    const { children, ...other } = props
    const itemData = React.Children.toArray(children)
    const itemCount = itemData.length
    const itemSize = 36

    const getChildSize = (child: React.ReactNode) => {
      if (React.isValidElement(child) && child.type === ListSubheader) {
        return 48
      }

      return itemSize
    }

    const getHeight = () => {
      if (itemCount > 8) {
        return 8 * itemSize
      }
      return itemData.map(getChildSize).reduce((a, b) => a + b, 0)
    }

    return (
      <div ref={ref}>
        <OuterElementContext.Provider value={other}>
          <VariableSizeList
            itemData={itemData}
            height={getHeight()}
            width="100%"
            key={itemCount}
            outerElementType={OuterElementType}
            innerElementType="ul"
            itemSize={(index: number) => getChildSize(itemData[index])}
            overscanCount={5}
            itemCount={itemCount}
          >
            {renderRow}
          </VariableSizeList>
        </OuterElementContext.Provider>
      </div>
    )
  },
)

function RefNameAutocomplete({
  model,
  onSelect,
  assemblyName,
  value,
  style,
  TextFieldProps = {},
}: {
  model: LinearGenomeViewModel
  onSelect: (region: Region | undefined) => void
  assemblyName?: string
  value?: string
  style?: React.CSSProperties
  TextFieldProps?: TFP
}) {
  const [possibleOptions, setPossibleOptions] = React.useState<Array<any>>([])
  // const [searchValue, setSearchValue] = React.useState<any | null>()
  const {
    coarseVisibleLocStrings,
    visibleLocStrings: nonCoarseVisibleLocStrings,
  } = model
  const session = getSession(model)
  const { assemblyManager } = getSession(model)
  const assembly = assemblyName && assemblyManager.get(assemblyName)
  const regions: Region[] = (assembly && assembly.regions) || []
  const visibleLocStrings =
    coarseVisibleLocStrings || nonCoarseVisibleLocStrings
  const loaded = regions.length !== 0

  useEffect(() => {
    let active = true
    // TODO: name indexing, gene search, identifier implementation
    if (loaded && active) {
      const options = regions.map(option => {
        return { type: 'reference sequence', value: option.refName }
      })
      setPossibleOptions(options)
      return undefined
    }
    return () => {
      active = false
    }
  }, [loaded, regions])

  function onChange(_: unknown, newRegionName: any | null) {
    if (newRegionName) {
      const newRegion: Region | undefined = regions.find(
        region =>
          region.refName === newRegionName.value ||
          region.refName === newRegionName.inputValue ||
          region.refName === newRegionName,
      )
      if (newRegion) {
        // @ts-ignore
        onSelect(getSnapshot(newRegion))
      } else {
        switch (typeof newRegionName) {
          case 'string':
            navTo(newRegionName)
            break
          default:
            navTo(newRegionName.inputValue || newRegionName.value)
        }
      }
    }
  }

  function navTo(locString: string) {
    try {
      model.navToLocString(locString)
    } catch (e) {
      console.warn(e)
      session.notify(`${e}`, 'warning')
    }
  }

  return (
    <Autocomplete
      id={`refNameAutocomplete-${model.id}`}
      freeSolo
      selectOnFocus
      disableClearable
      style={style}
      loading={loaded}
      value={visibleLocStrings || ''}
      disabled={!assemblyName || !loaded}
      options={possibleOptions} // sort them
      ListboxComponent={
        ListboxComponent as React.ComponentType<
          React.HTMLAttributes<HTMLElement>
        >
      }
      groupBy={option => String(option.type)}
      filterOptions={(options, params) => {
        const filtered = filter(options, params)
        // creates new option if user input does not match options
        if (params.inputValue !== '') {
          filtered.push({
            inputValue: params.inputValue,
            value: `Navigate to..."${params.inputValue}"`,
            type: 'Search',
          })
        }
        return filtered
      }}
      // onInputChange={(e, inputValue) => setSearchValue(inputValue)} use this to fetch for newOptions
      onChange={(e, newRegion) => onChange(e, newRegion)}
      renderInput={params => {
        const { helperText, InputProps = {} } = TextFieldProps
        const TextFieldInputProps = {
          ...params.InputProps,
          ...InputProps,
          endAdornment: (
            <>
              {!loaded ? <CircularProgress color="inherit" size={20} /> : null}
              {params.InputProps.endAdornment}
            </>
          ),
        }
        return (
          <TextField
            {...params}
            {...TextFieldProps}
            helperText={helperText}
            InputProps={TextFieldInputProps}
            placeholder="Search for location"
          />
        )
      }}
      getOptionLabel={option => {
        if (typeof option === 'string') {
          return option
        }
        if (option.inputValue) {
          return option.inputValue
        }
        return option.value
      }}
    />
  )
}

export default observer(RefNameAutocomplete)
