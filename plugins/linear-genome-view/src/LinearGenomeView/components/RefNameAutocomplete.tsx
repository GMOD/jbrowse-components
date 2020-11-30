/**
 * Based on https://material-ui.com/components/autocomplete/#Virtualize.tsx
 * Asynchronous Requests for autocomplete: https://material-ui.com/components/autocomplete/
 */
import { Region } from '@jbrowse/core/util/types'
import { getSession } from '@jbrowse/core/util'
import CircularProgress from '@material-ui/core/CircularProgress'
import ListSubheader from '@material-ui/core/ListSubheader'
import TextField, { TextFieldProps as TFP } from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import Autocomplete from '@material-ui/lab/Autocomplete'
// import SearchIcon from '@material-ui/icons/Search'
import { observer } from 'mobx-react'
import { getSnapshot } from 'mobx-state-tree'
import React, { useEffect } from 'react'
import { ListChildComponentProps, VariableSizeList } from 'react-window'
import { LinearGenomeViewModel } from '..'

// const filter = createFilterOptions()

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
  const [searchValue, setSearchValue] = React.useState<string>('')
  const [possibleOptions, setPossibleOptions] = React.useState<Array<string>>(
    [],
  )

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
  // state of the component
  const current = visibleLocStrings || ''
  const loading = !regions.length

  useEffect(() => {
    let active = true
    if (!loading && active) {
      setPossibleOptions(regions.map(option => option.refName))
      return undefined
    }
    // TODO: name indexing, gene search, identifier implementation
    return () => {
      active = false
    }
  }, [loading, regions])

  function onChange(event: any, newRegionName: string | null) {
    if (newRegionName) {
      const newRegion = regions.find(region => region.refName === newRegionName)
      if (newRegion) {
        // @ts-ignore
        onSelect(getSnapshot(newRegion))
      } else {
        // console.log(newRegionName.slice(16))
        navTo(newRegionName)
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
      // disableListWrap
      disableClearable
      selectOnFocus
      ListboxComponent={
        ListboxComponent as React.ComponentType<
          React.HTMLAttributes<HTMLElement>
        >
      }
      filterOptions={(options, params) => {
        // console.log(options)
        // console.log(params)
        // create using createFilters from autocomplete
        const filtered = options.filter(option => option !== searchValue)
        // Use locstring option to navigate
        if (!(searchValue in filtered)) {
          if (searchValue !== '') {
            filtered.push(searchValue)
          }
        }
        return filtered
      }}
      options={possibleOptions}
      loading={loading}
      value={current}
      disabled={!assemblyName || loading}
      style={style}
      onChange={(e, newRegion) => onChange(e, newRegion)}
      onInputChange={(e, inputValue) => setSearchValue(inputValue)}
      // onOpen={e => console.log('I am open')}
      renderInput={params => {
        const { helperText, InputProps = {} } = TextFieldProps
        const TextFieldInputProps = {
          ...params.InputProps,
          ...InputProps,
          endAdornment: (
            <>
              {loading ? <CircularProgress color="inherit" size={20} /> : null}
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
            placeholder="Navigate to..."
          />
        )
      }}
      renderOption={option => <Typography noWrap>{option}</Typography>}
    />
  )
}

export default observer(RefNameAutocomplete)
