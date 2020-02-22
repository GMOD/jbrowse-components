/**
 * Based on https://material-ui.com/components/autocomplete/#Virtualize.tsx
 */
import { IRegion } from '@gmod/jbrowse-core/mst-types'
import { getSession, isAbortException } from '@gmod/jbrowse-core/util'
import CircularProgress from '@material-ui/core/CircularProgress'
import ListSubheader from '@material-ui/core/ListSubheader'
import { makeStyles } from '@material-ui/core/styles'
import TextField, { TextFieldProps as TFP } from '@material-ui/core/TextField'
import Typography from '@material-ui/core/Typography'
import Autocomplete from '@material-ui/lab/Autocomplete'
import { Instance } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import { ListChildComponentProps, VariableSizeList } from 'react-window'
import { LinearGenomeViewStateModel } from '..'

type LGV = Instance<LinearGenomeViewStateModel>

const LISTBOX_PADDING = 8 // px

function renderRow(props: ListChildComponentProps) {
  const { data, index, style } = props
  return React.cloneElement(data[index], {
    style: {
      ...style,
      top: (style.top as number) + LISTBOX_PADDING,
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
            height={getHeight() + 2 * LISTBOX_PADDING}
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

const useStyles = makeStyles({
  listbox: {
    '& ul': {
      padding: 0,
      margin: 0,
    },
  },
})

export default function RefNameAutocomplete({
  model,
  onSelect,
  assemblyName,
  defaultRegionName,
  TextFieldProps,
}: {
  model: LGV
  onSelect: (region: IRegion | undefined) => void
  assemblyName?: string
  defaultRegionName?: string
  TextFieldProps?: TFP
}) {
  const [regions, setRegions] = useState<IRegion[]>([])
  const [selectedRegionName, setSelectedRegionName] = useState<
    string | undefined
  >(defaultRegionName)
  const [error, setError] = useState('')
  const loading = !!assemblyName && regions.length === 0
  const {
    getRegionsForAssemblyName,
  }: {
    getRegionsForAssemblyName: (
      assemblyName: string,
      { signal }: { signal?: AbortSignal },
    ) => Promise<IRegion[]>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = getSession(model) as any

  useEffect(() => {
    setRegions([])
    onSelect(undefined)
    setError('')
    if (defaultRegionName) {
      setSelectedRegionName(defaultRegionName)
    } else {
      setSelectedRegionName(undefined)
    }
  }, [assemblyName, defaultRegionName, onSelect])

  useEffect(() => {
    let aborter: AbortController
    let mounted = true
    async function fetchRegions() {
      if (mounted && assemblyName) {
        try {
          aborter = new AbortController()
          const fetchedRegions = await getRegionsForAssemblyName(assemblyName, {
            signal: aborter.signal,
          })
          if (mounted) {
            setRegions(fetchedRegions)
            if (!defaultRegionName) {
              setSelectedRegionName(fetchedRegions[0].refName)
              onSelect(fetchedRegions[0])
            }
          }
        } catch (e) {
          if (!isAbortException(e) && mounted) {
            setError(String(e))
          }
        }
      }
    }
    fetchRegions()

    return () => {
      mounted = false
      aborter && aborter.abort()
    }
  }, [assemblyName, defaultRegionName, getRegionsForAssemblyName, onSelect])
  const classes = useStyles()

  const regionNames = regions.map(region => region.refName)

  function onChange(event: React.ChangeEvent<{}>, newRegionName: string) {
    setSelectedRegionName(newRegionName)
    onSelect(regions.find(region => region.refName === newRegionName))
  }

  return (
    <Autocomplete
      id="refNameAutocomplete"
      disableListWrap
      disableClearable
      classes={classes}
      ListboxComponent={
        ListboxComponent as React.ComponentType<
          React.HTMLAttributes<HTMLElement>
        >
      }
      options={regionNames}
      value={
        !assemblyName || loading || !selectedRegionName
          ? ''
          : selectedRegionName
      }
      disabled={!assemblyName || loading}
      onChange={onChange}
      renderInput={params => {
        const helperText =
          error || (TextFieldProps && TextFieldProps.helperText) || undefined
        const TextFieldInputProps = {
          ...params.InputProps,
          ...((TextFieldProps && TextFieldProps.InputProps) || {}),
          endAdornment: (
            <React.Fragment>
              {loading && !error ? (
                <CircularProgress color="inherit" size={20} />
              ) : null}
              {params.InputProps.endAdornment}
            </React.Fragment>
          ),
        }
        return (
          <TextField
            {...params}
            {...(TextFieldProps || {})}
            helperText={helperText}
            error={!!error}
            InputProps={TextFieldInputProps}
          />
        )
      }}
      renderOption={regionName => <Typography noWrap>{regionName}</Typography>}
    />
  )
}
