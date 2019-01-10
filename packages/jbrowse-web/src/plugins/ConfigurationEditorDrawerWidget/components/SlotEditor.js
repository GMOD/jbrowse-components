import React from 'react'
import { observer, inject } from 'mobx-react'
import {
  TextField,
  InputLabel,
  FormHelperText,
  MenuItem,
  Icon,
} from '@material-ui/core'
import { getPropertyMembers } from 'mobx-state-tree'
import ColorEditor from './ColorEditor'

const StringEditor = observer(({ slot, slotSchema }) => (
  <TextField
    label={slot.name}
    // error={filterError}
    helperText={slot.description}
    fullWidth
    value={slot.value}
    onChange={evt => slot.set(evt.target.value)}
  />
))

const StringArrayEditor = inject('classes')(
  observer(({ slot, slotSchema, classes }) => (
    <>
      <InputLabel>{slot.name}</InputLabel>
      <div className={classes.stringArrayEditor}>
        {slot.value.map((val, idx) => (
          <div key={val} className={classes.stringArrayItem}>
            <input
              type="text"
              value={val}
              onChange={evt => {
                slot.setAtIndex(idx, evt.target.value)
              }}
            />
            <button
              className={classes.stringArrayEditorDelete}
              type="button"
              onClick={() => slot.removeAtIndex(idx)}
            >
              remove
            </button>
          </div>
        ))}
        <button
          className={classes.stringArrayEditorAdd}
          type="button"
          onClick={() => slot.add('')}
        >
          add
        </button>
      </div>
      <FormHelperText>{slot.description}</FormHelperText>
    </>
  )),
)

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
  if (!value.uri) throw new Error('local files not yet supported')
  return (
    <TextField
      value={slot.value.uri}
      label={slot.name}
      // error={filterError}
      helperText={slot.description}
      fullWidth
      onChange={evt => slot.set({ uri: evt.target.value })}
    />
  )
})

const FunctionEditor = observer(({ slot, slotSchema }) => (
  <textarea value={slot.value} onChange={evt => slot.set(evt.target.value)} />
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
  number: NumberEditor,
  integer: IntegerEditor,
  color: ColorEditor,
  stringEnum: stringEnumEditor,
}

const SlotEditor = inject('classes')(
  observer(({ slot, slotSchema, classes }) => {
    const { name, description, type, value } = slot
    const ValueComponent = /^\s*function\s*\(/.test(value)
      ? FunctionEditor
      : valueComponents[type] || StringEditor
    if (!(type in valueComponents)) console.log(`need to implement ${type}`)
    return (
      <div className={classes.slotContainer}>
        <ValueComponent slot={slot} slotSchema={slotSchema} />
        <button
          className={classes.slotModeSwitch}
          onClick={() =>
            slot.isCallback ? slot.convertToValue() : slot.convertToCallback()
          }
          title={`convert to ${slot.isCallback ? 'regular value' : 'callback'}`}
          type="button"
        >
          <Icon>{slot.isCallback ? 'radio_button_unchecked' : 'code'}</Icon>
        </button>
      </div>
    )
  }),
)

export default SlotEditor
