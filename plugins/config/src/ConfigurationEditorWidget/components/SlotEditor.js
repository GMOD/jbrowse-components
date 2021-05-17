import { FileSelector } from '@jbrowse/core/ui'
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
  List,
  ListItem,
  MenuItem,
  Paper,
  SvgIcon,
  TextField,
  makeStyles,
} from '@material-ui/core'

import DeleteIcon from '@material-ui/icons/Delete'
import AddIcon from '@material-ui/icons/Add'
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked'
import { observer } from 'mobx-react'
import { getPropertyMembers } from 'mobx-state-tree'
import React, { useEffect, useState } from 'react'
import CallbackEditor from './CallbackEditor'
import ColorEditor from './ColorEditor'
import JsonEditor from './JsonEditor'

const StringEditor = observer(({ slot }) => (
  <TextField
    label={slot.name}
    // error={filterError}
    helperText={slot.description}
    fullWidth
    value={slot.value}
    onChange={evt => slot.set(evt.target.value)}
  />
))

const TextEditor = observer(({ slot }) => (
  <TextField
    label={slot.name}
    helperText={slot.description}
    fullWidth
    multiline
    value={slot.value}
    onChange={evt => slot.set(evt.target.value)}
  />
))

// checked checkbox, looks like a styled (x)
const SvgCheckbox = () => (
  <SvgIcon>
    <path d="M20.41,3C21.8,5.71 22.35,8.84 22,12C21.8,15.16 20.7,18.29 18.83,21L17.3,20C18.91,17.57 19.85,14.8 20,12C20.34,9.2 19.89,6.43 18.7,4L20.41,3M5.17,3L6.7,4C5.09,6.43 4.15,9.2 4,12C3.66,14.8 4.12,17.57 5.3,20L3.61,21C2.21,18.29 1.65,15.17 2,12C2.2,8.84 3.3,5.71 5.17,3M12.08,10.68L14.4,7.45H16.93L13.15,12.45L15.35,17.37H13.09L11.71,14L9.28,17.33H6.76L10.66,12.21L8.53,7.45H10.8L12.08,10.68Z" />
  </SvgIcon>
)

const StringArrayEditor = observer(({ slot }) => {
  const [value, setValue] = useState('')
  return (
    <>
      {slot.name ? <InputLabel>{slot.name}</InputLabel> : null}
      <List disablePadding>
        {slot.value.map((val, idx) => (
          <ListItem key={idx} disableGutters>
            <TextField
              value={val}
              onChange={evt => slot.setAtIndex(idx, evt.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment>
                    <IconButton
                      color="secondary"
                      onClick={() => slot.removeAtIndex(idx)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </ListItem>
        ))}
        <ListItem disableGutters>
          <TextField
            value={value}
            placeholder="add new"
            onChange={event => setValue(event.target.value)}
            InputProps={{
              endAdornment: (
                <InputAdornment>
                  <IconButton
                    onClick={() => {
                      slot.add(value)
                      setValue('')
                    }}
                    disabled={value === ''}
                    color="secondary"
                    data-testid={`stringArrayAdd-${slot.name}`}
                  >
                    <AddIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </ListItem>
      </List>
      <FormHelperText>{slot.description}</FormHelperText>
    </>
  )
})

const useMapEditorStyles = makeStyles(theme => ({
  card: {
    marginTop: theme.spacing(1),
  },
}))

const StringArrayMapEditor = observer(({ slot }) => {
  const classes = useMapEditorStyles()
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
                value: val,
                description: `Values associated with entry ${key}`,
                setAtIndex: (idx, strValue) => {
                  slot.setAtKeyIndex(key, idx, strValue)
                },
                removeAtIndex: idx => {
                  slot.removeAtKeyIndex(key, idx)
                },
                add: strValue => {
                  slot.addToKey(key, strValue)
                },
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
                  <InputAdornment>
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
})

const NumberMapEditor = observer(({ slot }) => {
  const classes = useMapEditorStyles()
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
                set: numValue => slot.add(key, numValue),
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
                  <InputAdornment>
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
})

const NumberEditor = observer(({ slot }) => {
  const [val, setVal] = useState(slot.value)
  useEffect(() => {
    const num = parseFloat(val, 10)
    if (!Number.isNaN(num)) {
      slot.set(num)
    } else {
      slot.reset()
    }
  }, [slot, val])
  return (
    <TextField
      label={slot.name}
      helperText={slot.description}
      value={val}
      type="number"
      onChange={evt => setVal(evt.target.value)}
    />
  )
})

const IntegerEditor = observer(({ slot }) => {
  const [val, setVal] = useState(slot.value)
  useEffect(() => {
    const num = parseInt(val, 10)
    if (!Number.isNaN(num)) {
      slot.set(num)
    }
  }, [slot, val])
  return (
    <TextField
      label={slot.name}
      helperText={slot.description}
      value={val}
      type="number"
      onChange={evt => setVal(evt.target.value)}
    />
  )
})

const booleanEditor = observer(({ slot }) => (
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
))

const stringEnumEditor = observer(({ slot, slotSchema }) => {
  const p = getPropertyMembers(getSubType(slotSchema))
  const choices = getUnionSubTypes(
    getUnionSubTypes(getSubType(getPropertyType(p, 'value')))[1],
  ).map(t => t.value)

  return (
    <TextField
      value={slot.value}
      label={slot.name}
      select
      // error={filterError}
      helperText={slot.description}
      fullWidth
      onChange={evt => slot.set(evt.target.value)}
    >
      {choices.map(str => (
        <MenuItem key={str} value={str}>
          {str}
        </MenuItem>
      ))}
    </TextField>
  )
})

const FileSelectorWrapper = observer(({ slot }) => {
  return (
    <FileSelector
      location={slot.value}
      setLocation={location => slot.set(location)}
      name={slot.name}
      description={slot.description}
    />
  )
})

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
  stringEnum: stringEnumEditor,
  boolean: booleanEditor,
  frozen: JsonEditor,
  configRelationships: JsonEditor,
}

export const useSlotEditorStyles = makeStyles(theme => ({
  paper: {
    display: 'flex',
    marginBottom: theme.spacing(2),
    position: 'relative',
    overflow: 'visible',
  },
  paperContent: {
    flex: 'auto',
    padding: theme.spacing(1),
    overflow: 'auto',
  },
  slotModeSwitch: {
    width: 24,
    background: theme.palette.secondary.light,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
}))

const SlotEditor = observer(({ slot, slotSchema }) => {
  const classes = useSlotEditorStyles()
  const { type } = slot
  let ValueComponent = slot.isCallback ? CallbackEditor : valueComponents[type]
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
            className={classes.slotModeIcon}
            onClick={() =>
              slot.isCallback ? slot.convertToValue() : slot.convertToCallback()
            }
            title={`convert to ${
              slot.isCallback ? 'regular value' : 'callback'
            }`}
            color="secondary"
          >
            {!slot.isCallback ? <RadioButtonUncheckedIcon /> : <SvgCheckbox />}
          </IconButton>
        ) : null}
      </div>
    </Paper>
  )
})

export default SlotEditor
