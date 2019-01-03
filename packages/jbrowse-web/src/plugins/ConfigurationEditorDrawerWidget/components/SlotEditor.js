import React from 'react'
import { observer, inject } from 'mobx-react'
import { TextField, InputLabel, FormHelperText } from '@material-ui/core'
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

const NumberEditor = observer(({ slot, slotSchema }) => (
  <input
    type="text"
    value={slot.value}
    onChange={evt => {
      const num = Number(evt.target.value)
      if (!Number.isNaN(num)) slot.set(num)
    }}
  />
))

const IntegerEditor = observer(({ slot, slotSchema }) => (
  <input
    type="number"
    value={slot.value}
    onChange={evt => {
      const num = Number(evt.target.value)
      if (!Number.isNaN(num)) slot.set(num)
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

const valueComponents = {
  string: StringEditor,
  fileLocation: FileLocationEditor,
  stringArray: StringArrayEditor,
  number: NumberEditor,
  integer: IntegerEditor,
  color: ColorEditor,
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
        {/* <div className={classes.slotName}>{name}</div>
        <div className={classes.description}>{description}</div> */}
        <ValueComponent slot={slot} slotSchema={slotSchema} />
      </div>
    )
  }),
)

export default SlotEditor
