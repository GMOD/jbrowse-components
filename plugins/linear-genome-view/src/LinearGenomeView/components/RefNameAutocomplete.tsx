/**
 * Based on https://material-ui.com/components/autocomplete/#Virtualize.tsx
 */
import { Region } from '@jbrowse/core/util/types'
import { Region as MSTRegion } from '@jbrowse/core/util/types/mst'
import { getSession } from '@jbrowse/core/util'
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

const RefNameAutocomplete = observer(
  ({
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
  }) => {
    const { assemblyManager } = getSession(model)
    const assembly = assemblyName && assemblyManager.get(assemblyName)
    const regions = (assembly && assembly.regions) || []
    const loading = !regions.length
    const [selected, setSelected] = useState(defaultRegionName)
    const current =
      selected || (regions.length ? regions[0].refName : undefined)

    useEffect(() => {
      const newRegion = regions.find(region => region.refName === current)
      if (newRegion) {
        onSelect(getSnapshot(newRegion))
      }
    }, [onSelect, current, regions])

    function onChange(_: unknown, newRegionName: string | null) {
      if (newRegionName) {
        setSelected(newRegionName)
      }
    }

    return (
      <Autocomplete
        id={`refNameAutocomplete-${model.id}`}
        disableListWrap
        disableClearable
        ListboxComponent={
          ListboxComponent as React.ComponentType<
            React.HTMLAttributes<HTMLElement>
          >
        }
        options={regions.map(region => region.refName)}
        loading
        value={current || ''}
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
                {loading ? (
                  <CircularProgress color="inherit" size={20} />
                ) : null}
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
        renderOption={regionName => (
          <Typography noWrap>{regionName}</Typography>
        )}
      />
    )
  },
)

export default RefNameAutocomplete
