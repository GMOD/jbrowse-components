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
  InputLabel,
  List,
  ListItem,
  MenuItem,
  Paper,
  SvgIcon,
  TextField,
  withStyles,
  InputAdornment,
} from '@material-ui/core'
import { observer, PropTypes as MobxPropTypes } from 'mobx-react'
import { getPropertyMembers } from 'mobx-state-tree'
import PropTypes from 'prop-types'
import React from 'react'
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

@observer
class StringArrayEditor extends React.Component {
  static propTypes = {
    slot: MobxPropTypes.objectOrObservableObject.isRequired,
  }

  state = {
    newString: '',
  }

  render() {
    const { newString } = this.state
    const { slot } = this.props
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
              value={newString}
              placeholder="add new"
              onChange={event =>
                this.setState({ newString: event.target.value })
              }
              InputProps={{
                endAdornment: (
                  <InputAdornment>
                    <IconButton
                      onClick={() => {
                        slot.add(newString)
                        this.setState({ newString: '' })
                      }}
                      disabled={newString === ''}
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
  }
}

const stringArrayMapEditorStyles = theme => ({
  card: {
    marginTop: theme.spacing.unit,
  },
})

// eslint-disable-next-line react/no-multi-comp
@withStyles(stringArrayMapEditorStyles)
@observer
class StringArrayMapEditor extends React.Component {
  static propTypes = {
    slot: MobxPropTypes.observableObject.isRequired,
    classes: PropTypes.objectOf(PropTypes.string).isRequired,
  }

  state = {
    newString: '',
  }

  render() {
    const { newString } = this.state
    const { slot, classes } = this.props
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
                  setAtIndex: (idx, value) => {
                    slot.setAtKeyIndex(key, idx, value)
                  },
                  removeAtIndex: idx => {
                    slot.removeAtKeyIndex(key, idx)
                  },
                  add: value => {
                    slot.addToKey(key, value)
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
                value={newString}
                placeholder="add new"
                onChange={event =>
                  this.setState({ newString: event.target.value })
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment>
                      <IconButton
                        disabled={newString === ''}
                        onClick={() => {
                          slot.add(newString, [])
                          this.setState({ newString: '' })
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
  }
}

const NumberEditor = observer(({ slot }) => (
  <TextField
    label={slot.name}
    helperText={slot.description}
    value={slot.value}
    type="number"
    onChange={evt => {
      const num = Number(evt.target.value)
      if (!Number.isNaN(num)) slot.set(num)
    }}
  />
))

const IntegerEditor = observer(({ slot }) => (
  <TextField
    label={slot.name}
    helperText={slot.description}
    value={slot.value}
    type="number"
    onChange={evt => {
      const num = Number(evt.target.value)
      if (!Number.isNaN(num)) slot.set(Math.round(num))
    }}
  />
))

const FileLocationEditor = observer(({ slot }) => {
  // TODO: this can only edit URIs right now, need to make this an actual
  // good file selector
  const { value } = slot
  return (
    <TextField
      value={value.uri}
      label={slot.name}
      // error={filterError}
      helperText={slot.description}
      fullWidth
      onChange={evt => slot.set({ uri: evt.target.value })}
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
    marginBottom: theme.spacing.unit * 2,
    position: 'relative',
    overflow: 'visible',
  },
  paperContent: {
    flex: 'auto',
    padding: theme.spacing.unit,
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
    if (!(type in valueComponents)) console.log(`need to implement ${type}`)
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
              <SvgIcon>
                <path d="M20.41,3C21.8,5.71 22.35,8.84 22,12C21.8,15.16 20.7,18.29 18.83,21L17.3,20C18.91,17.57 19.85,14.8 20,12C20.34,9.2 19.89,6.43 18.7,4L20.41,3M5.17,3L6.7,4C5.09,6.43 4.15,9.2 4,12C3.66,14.8 4.12,17.57 5.3,20L3.61,21C2.21,18.29 1.65,15.17 2,12C2.2,8.84 3.3,5.71 5.17,3M12.08,10.68L14.4,7.45H16.93L13.15,12.45L15.35,17.37H13.09L11.71,14L9.28,17.33H6.76L10.66,12.21L8.53,7.45H10.8L12.08,10.68Z" />
              </SvgIcon>
            )}
          </IconButton>
        </div>
      </Paper>
    )
  }),
)

export default SlotEditor
