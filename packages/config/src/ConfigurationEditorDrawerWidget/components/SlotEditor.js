import {
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Icon,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  SvgIcon,
  TextField,
  withStyles,
} from '@material-ui/core'
import { observer } from 'mobx-react-lite'
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

// checked checkbox, looks like a styled (x)
const SvgCheckbox = () => (
  <SvgIcon>
    <path d="M20.41,3C21.8,5.71 22.35,8.84 22,12C21.8,15.16 20.7,18.29 18.83,21L17.3,20C18.91,17.57 19.85,14.8 20,12C20.34,9.2 19.89,6.43 18.7,4L20.41,3M5.17,3L6.7,4C5.09,6.43 4.15,9.2 4,12C3.66,14.8 4.12,17.57 5.3,20L3.61,21C2.21,18.29 1.65,15.17 2,12C2.2,8.84 3.3,5.71 5.17,3M12.08,10.68L14.4,7.45H16.93L13.15,12.45L15.35,17.37H13.09L11.71,14L9.28,17.33H6.76L10.66,12.21L8.53,7.45H10.8L12.08,10.68Z" />
  </SvgIcon>
)

const StringArrayEditor = observer(props => {
  const { slot } = props
  const [value, setValue] = useState('')
  return (
    <>
      {slot.name ? <InputLabel>{slot.name}</InputLabel> : null}
      <List dense disablePadding>
        {slot.value.map((val, idx) => (
          <ListItem
            key={idx} // eslint-disable-line react/no-array-index-key
            dense
            disableGutters
          >
            <TextField
              value={val}
              onChange={evt => slot.setAtIndex(idx, evt.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment>
                    <IconButton onClick={() => slot.removeAtIndex(idx)}>
                      <Icon>delete</Icon>
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </ListItem>
        ))}
        <ListItem dense disableGutters>
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
                  >
                    <Icon>add</Icon>
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

const mapEditorStyles = theme => ({
  card: {
    marginTop: theme.spacing(1),
  },
})

const StringArrayMapEditor = withStyles(mapEditorStyles)(
  observer(props => {
    const { slot, classes } = props
    const [value, setValue] = useState('')
    return (
      <>
        <InputLabel>{slot.name}</InputLabel>
        {Array.from(slot.value, ([key, val]) => (
          <Card
            raised
            key={key} // eslint-disable-line react/no-array-index-key
            className={classes.card}
          >
            <CardHeader
              title={key}
              action={
                <IconButton onClick={() => slot.remove(key)}>
                  <Icon>delete</Icon>
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
                      >
                        <Icon>add</Icon>
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
  }),
)

const NumberMapEditor = withStyles(mapEditorStyles)(
  observer(props => {
    const { slot, classes } = props
    const [value, setValue] = useState('')
    return (
      <>
        <InputLabel>{slot.name}</InputLabel>
        {Array.from(slot.value, ([key, val]) => (
          <Card
            raised
            key={key} // eslint-disable-line react/no-array-index-key
            className={classes.card}
          >
            <CardHeader
              title={key}
              action={
                <IconButton onClick={() => slot.remove(key)}>
                  <Icon>delete</Icon>
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
                      >
                        <Icon>add</Icon>
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
  }),
)

const NumberEditor = observer(({ slot }) => {
  const [val, setVal] = useState(slot.value)
  useEffect(() => {
    const num = parseFloat(val, 10)
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

export const FileLocationEditor = observer(({ slot }) => {
  // TODO: this can only edit URIs right now, need to make this an actual
  // good file selector
  const { value } = slot
  return (
    <>
      <FormControl component="fieldset">
        <RadioGroup
          value={value.uri === undefined ? 'localPath' : 'uri'}
          onChange={event => {
            if (event.target.value === 'uri') slot.set({ uri: '' })
            else slot.set({ localPath: '' })
          }}
        >
          <FormControlLabel value="uri" control={<Radio />} label="URL" />
          <FormControlLabel
            disabled
            value="localPath"
            control={<Radio />}
            label="Local File"
          />
        </RadioGroup>
      </FormControl>
      <TextField
        value={value.uri === undefined ? value.localPath : value.uri}
        label={slot.name}
        // error={filterError}
        helperText={slot.description}
        fullWidth
        onChange={evt => slot.set({ uri: evt.target.value })}
      />
    </>
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
  const p = getPropertyMembers(slotSchema.type)
  const choices = p.properties.value.type.types[1].types.map(t => t.value)

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

const valueComponents = {
  string: StringEditor,
  fileLocation: FileLocationEditor,
  stringArray: StringArrayEditor,
  stringArrayMap: StringArrayMapEditor,
  numberMap: NumberMapEditor,
  number: NumberEditor,
  integer: IntegerEditor,
  color: ColorEditor,
  stringEnum: stringEnumEditor,
  boolean: booleanEditor,
  frozen: JsonEditor,
}

export const slotEditorStyles = theme => ({
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
})

const SlotEditor = withStyles(slotEditorStyles)(
  observer(({ slot, slotSchema, classes }) => {
    const { type } = slot
    let ValueComponent = slot.isCallback
      ? CallbackEditor
      : valueComponents[type]
    if (!ValueComponent) {
      console.warn(`no slot editor defined for ${type}, editing as string`)
      ValueComponent = StringEditor
    }
    if (!(type in valueComponents))
      console.warn(`SlotEditor needs to implement ${type}`)
    return (
      <Paper className={classes.paper}>
        <div className={classes.paperContent}>
          <ValueComponent slot={slot} slotSchema={slotSchema} />
        </div>
        <div className={classes.slotModeSwitch}>
          <IconButton
            className={classes.slotModeIcon}
            onClick={() =>
              slot.isCallback ? slot.convertToValue() : slot.convertToCallback()
            }
            title={`convert to ${
              slot.isCallback ? 'regular value' : 'callback'
            }`}
          >
            {!slot.isCallback ? (
              <Icon>radio_button_unchecked</Icon>
            ) : (
              <SvgCheckbox />
            )}
          </IconButton>
        </div>
      </Paper>
    )
  }),
)

export default SlotEditor
