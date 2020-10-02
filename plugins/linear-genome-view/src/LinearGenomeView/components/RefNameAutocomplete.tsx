/**
 * Based on https://material-ui.com/components/autocomplete/#Virtualize.tsx
 */
import { Region } from '@gmod/jbrowse-core/util/types'
import { Region as MSTRegion } from '@gmod/jbrowse-core/util/types/mst'
import { getSession } from '@gmod/jbrowse-core/util'
import CircularProgress from '@material-ui/core/CircularProgress'
import ListSubheader from '@material-ui/core/ListSubheader'
import TextField, { TextFieldProps as TFP } from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import Autocomplete from '@material-ui/lab/Autocomplete'
import { observer } from 'mobx-react'
import { getSnapshot, Instance } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import { ListChildComponentProps, VariableSizeList } from 'react-window'
import { LinearGenomeViewModel } from '..'

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
  defaultRegionName,
  style,
  TextFieldProps = {},
}: {
  model: LinearGenomeViewModel
  onSelect: (region: Region | undefined) => void
  assemblyName?: string
  defaultRegionName?: string
  style?: React.CSSProperties
  TextFieldProps?: TFP
}) {
  const [selectedRegionName, setSelectedRegionName] = useState<
    string | undefined
  >(defaultRegionName)
  const { assemblyManager } = getSession(model)

  let regions: Instance<typeof MSTRegion>[] = []
  if (assemblyName) {
    const assembly = assemblyManager.get(assemblyName)
    if (assembly && assembly.regions) {
      regions = assembly.regions
    }
  }
  const loading = regions.length === 0
  useEffect(() => {
    onSelect(undefined)
    if (defaultRegionName !== undefined) {
      setSelectedRegionName(defaultRegionName)
    } else if (!loading) {
      setSelectedRegionName(regions[0].refName)
      onSelect(getSnapshot(regions[0]))
    } else {
      setSelectedRegionName(undefined)
    }
  }, [assemblyName, defaultRegionName, onSelect, loading, regions])

  const regionNames = regions.map(region => region.refName)

  function onChange(_: unknown, newRegionName: string | null) {
    if (newRegionName) {
      setSelectedRegionName(newRegionName)
      const newRegion = regions.find(region => region.refName === newRegionName)
      if (newRegion) {
        onSelect(getSnapshot(newRegion))
      }
    }
  }

  return !assemblyName || loading || !selectedRegionName ? null : (
    <Autocomplete
      id={`refNameAutocomplete-${model.id}`}
      disableListWrap
      ListboxComponent={
        ListboxComponent as React.ComponentType<
          React.HTMLAttributes<HTMLElement>
        >
      }
      disableClearable
      options={regionNames}
      value={selectedRegionName}
      disabled={!assemblyName || loading}
      style={style}
      onChange={onChange}
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
          />
        )
      }}
      renderOption={regionName => <Typography noWrap>{regionName}</Typography>}
    />
  )
}

export default observer(RefNameAutocomplete)
