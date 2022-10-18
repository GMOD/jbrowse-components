import React, { useEffect, useState } from 'react'
import { observer } from 'mobx-react'
import { getPropertyMembers, IAnyType } from 'mobx-state-tree'
import { getEnv, FileLocation } from '@jbrowse/core/util'
import { FileSelector, SanitizedHTML } from '@jbrowse/core/ui'
import {
  getPropertyType,
  getSubType,
  getUnionSubTypes,
} from '@jbrowse/core/util/mst-reflection'
import {
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  SvgIcon,
  TextField,
  TextFieldProps,
} from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// icons
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'

// locals
import StringArrayEditor from './StringArrayEditor'
import CallbackEditor from './CallbackEditor'
import ColorEditor from './ColorEditor'
import JsonEditor from './JsonEditor'

// adds ability to have html in helperText. note that FormHelperTextProps is
// div because the default is p which does not like div children
function MyTextField(props: { helperText?: string } & TextFieldProps) {
  const { helperText } = props
  return (
    <TextField
      {...props}
      helperText={<SanitizedHTML html={helperText || ''} />}
      FormHelperTextProps={{
        // @ts-ignore
        component: 'div',
      }}
      fullWidth
    />
  )
}

const StringEditor = observer(
  ({
    slot,
  }: {
    slot: {
      name: string
      description: string
      value: string
      set: (arg: string) => void
    }
  }) => (
    <MyTextField
      label={slot.name}
      helperText={slot.description}
      value={slot.value}
      onChange={evt => slot.set(evt.target.value)}
    />
  ),
)

const TextEditor = observer(
  ({
    slot,
  }: {
    slot: {
      name: string
      description: string
      value: string
      set: (arg: string) => void
    }
  }) => (
    <TextField
      label={slot.name}
      helperText={slot.description}
      multiline
      value={slot.value}
      onChange={evt => slot.set(evt.target.value)}
    />
  ),
)

// checked checkbox, looks like a styled (x)
const SvgCheckbox = () => (
  <SvgIcon>
    <path d="M20.41,3C21.8,5.71 22.35,8.84 22,12C21.8,15.16 20.7,18.29 18.83,21L17.3,20C18.91,17.57 19.85,14.8 20,12C20.34,9.2 19.89,6.43 18.7,4L20.41,3M5.17,3L6.7,4C5.09,6.43 4.15,9.2 4,12C3.66,14.8 4.12,17.57 5.3,20L3.61,21C2.21,18.29 1.65,15.17 2,12C2.2,8.84 3.3,5.71 5.17,3M12.08,10.68L14.4,7.45H16.93L13.15,12.45L15.35,17.37H13.09L11.71,14L9.28,17.33H6.76L10.66,12.21L8.53,7.45H10.8L12.08,10.68Z" />
  </SvgIcon>
)

const useMapEditorStyles = makeStyles()(theme => ({
  card: {
    marginTop: theme.spacing(1),
  },
}))

const StringArrayMapEditor = observer(
  ({
    slot,
  }: {
    slot: {
      name: string
      value: Map<string, string[]>
      remove: (key: string) => void
      add: (key: string, val: string[]) => void
      description: string
      setAtKeyIndex: (key: string, idx: number, val: string) => void
      removeAtKeyIndex: (key: string, idx: number) => void
      addToKey: (key: string, val: string) => void
    }
  }) => {
    const { classes } = useMapEditorStyles()
    const [value, setValue] = useState('')
    return (
      <>
        <InputLabel>{slot.name}</InputLabel>
        {Array.from(slot.value, ([key, val]) => (
          <Card raised key={key} className={classes.card}>
            <CardHeader
              title={key}
              action={
                <IconButton color="secondary" onClick={() => slot.remove(key)}>
                  <DeleteIcon />
                </IconButton>
              }
            />
            <CardContent>
              <StringArrayEditor
                slot={{
                  name: slot.name,
                  value: val,
                  description: `Values associated with entry ${key}`,
                  setAtIndex: (idx: number, val: string) =>
                    slot.setAtKeyIndex(key, idx, val),
                  removeAtIndex: (idx: number) =>
                    slot.removeAtKeyIndex(key, idx),
                  add: (val: string) => slot.addToKey(key, val),
                }}
              />
            </CardContent>
          </Card>
        ))}
        <Card raised className={classes.card}>
          <CardHeader
            disableTypography
            title={
              <TextField
                fullWidth
                value={value}
                placeholder="add new"
                onChange={event => setValue(event.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        disabled={value === ''}
                        onClick={() => {
                          slot.add(value, [])
                          setValue('')
                        }}
                        color="secondary"
                      >
                        <AddIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            }
          />
        </Card>
        <FormHelperText>{slot.description}</FormHelperText>
      </>
    )
  },
)

const NumberMapEditor = observer(
  ({
    slot,
  }: {
    slot: {
      name: string
      value: Map<string, string>
      remove: (key: string) => void
      add: (key: string, val: number) => void
      description: string
    }
  }) => {
    const { classes } = useMapEditorStyles()
    const [value, setValue] = useState('')
    return (
      <>
        <InputLabel>{slot.name}</InputLabel>
        {Array.from(slot.value, ([key, val]) => (
          <Card raised key={key} className={classes.card}>
            <CardHeader
              title={key}
              action={
                <IconButton color="secondary" onClick={() => slot.remove(key)}>
                  <DeleteIcon />
                </IconButton>
              }
            />
            <CardContent>
              <NumberEditor
                slot={{
                  value: val,
                  set: (val: number) => slot.add(key, val),
                }}
              />
            </CardContent>
          </Card>
        ))}
        <Card raised className={classes.card}>
          <CardHeader
            disableTypography
            title={
              <TextField
                fullWidth
                value={value}
                placeholder="add new"
                onChange={event => setValue(event.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        disabled={value === ''}
                        onClick={() => {
                          slot.add(value, 0)
                          setValue('')
                        }}
                        color="secondary"
                      >
                        <AddIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            }
          />
        </Card>
        <FormHelperText>{slot.description}</FormHelperText>
      </>
    )
  },
)

const NumberEditor = observer(
  ({
    slot,
  }: {
    slot: {
      name?: string
      value: string
      description?: string
      set: (val: number) => void
      reset?: () => void
    }
  }) => {
    const [val, setVal] = useState(slot.value)
    useEffect(() => {
      const num = parseFloat(val)
      if (!Number.isNaN(num)) {
        slot.set(num)
      } else {
        slot.reset?.()
      }
    }, [slot, val])
    return (
      <MyTextField
        label={slot.name}
        helperText={slot.description}
        value={val}
        type="number"
        onChange={evt => setVal(evt.target.value)}
      />
    )
  },
)

const IntegerEditor = observer(
  ({
    slot,
  }: {
    slot: {
      name: string
      value: string
      description: string
      set: (num: number) => void
    }
  }) => {
    const [val, setVal] = useState(slot.value)
    useEffect(() => {
      const num = parseInt(val, 10)
      if (!Number.isNaN(num)) {
        slot.set(num)
      }
    }, [slot, val])
    return (
      <MyTextField
        label={slot.name}
        helperText={slot.description}
        value={val}
        type="number"
        onChange={evt => setVal(evt.target.value)}
      />
    )
  },
)

const BooleanEditor = observer(
  ({
    slot,
  }: {
    slot: {
      name: string
      value: boolean
      set: (arg: boolean) => void
      description: string
    }
  }) => (
    <FormControl>
      <FormControlLabel
        label={slot.name}
        control={
          <Checkbox
            checked={slot.value}
            onChange={evt => slot.set(evt.target.checked)}
          />
        }
      />
      <FormHelperText>{slot.description}</FormHelperText>
    </FormControl>
  ),
)

const StringEnumEditor = observer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ slot, slotSchema }: { slot: any; slotSchema: IAnyType }) => {
    const p = getPropertyMembers(getSubType(slotSchema))
    const choices = getUnionSubTypes(
      getUnionSubTypes(getSubType(getPropertyType(p, 'value')))[1],
    ).map(t => t.value)

    return (
      <MyTextField
        value={slot.value}
        label={slot.name}
        select
        helperText={slot.description}
        onChange={evt => slot.set(evt.target.value)}
      >
        {choices.map(str => (
          <MenuItem key={str} value={str}>
            {str}
          </MenuItem>
        ))}
      </MyTextField>
    )
  },
)

const FileSelectorWrapper = observer(
  ({
    slot,
  }: {
    slot: {
      name: string
      value: FileLocation
      set: (arg: FileLocation) => void
      description: string
    }
  }) => {
    return (
      <FileSelector
        location={slot.value}
        setLocation={location => slot.set(location)}
        name={slot.name}
        description={slot.description}
        rootModel={getEnv(slot).pluginManager?.rootModel}
      />
    )
  },
)

const valueComponents = {
  string: StringEditor,
  text: TextEditor,
  fileLocation: FileSelectorWrapper,
  stringArray: StringArrayEditor,
  stringArrayMap: StringArrayMapEditor,
  numberMap: NumberMapEditor,
  number: NumberEditor,
  integer: IntegerEditor,
  color: ColorEditor,
  stringEnum: StringEnumEditor,
  boolean: BooleanEditor,
  frozen: JsonEditor,
  configRelationships: JsonEditor,
}

export const useSlotEditorStyles = makeStyles()(theme => ({
  paper: {
    display: 'flex',
    marginBottom: theme.spacing(2),
    position: 'relative',
  },
  paperContent: {
    width: '100%',
  },
  slotModeSwitch: {
    width: 24,
    background: theme.palette.secondary.light,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
}))

const SlotEditor = observer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ({ slot, slotSchema }: { slot: any; slotSchema: IAnyType }) => {
    const { classes } = useSlotEditorStyles()
    const { type } = slot
    let ValueComponent = slot.isCallback
      ? CallbackEditor
      : // @ts-ignore
        valueComponents[type]
    if (!ValueComponent) {
      console.warn(`no slot editor defined for ${type}, editing as string`)
      ValueComponent = StringEditor
    }
    if (!(type in valueComponents)) {
      console.warn(`SlotEditor needs to implement ${type}`)
    }
    return (
      <Paper className={classes.paper}>
        <div className={classes.paperContent}>
          <ValueComponent slot={slot} slotSchema={slotSchema} />
        </div>
        <div className={classes.slotModeSwitch}>
          {slot.contextVariable.length ? (
            <IconButton
              onClick={() =>
                slot.isCallback
                  ? slot.convertToValue()
                  : slot.convertToCallback()
              }
              title={`convert to ${
                slot.isCallback ? 'regular value' : 'callback'
              }`}
              color="secondary"
            >
              {!slot.isCallback ? (
                <RadioButtonUncheckedIcon />
              ) : (
                <SvgCheckbox />
              )}
            </IconButton>
          ) : null}
        </div>
      </Paper>
    )
  },
)

export default SlotEditor
