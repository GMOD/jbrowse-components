import React from 'react'
import { observer, inject } from 'mobx-react'

const valueComponents = {
  string: StringValueComponent,
}

const StringValueComponent = observer(({ slot, slotSchema }) => (
  <input
    type="text"
    value={slot.value}
    onChange={evt => slot.set(evt.target.value)}
  />
))

const FunctionEditor = observer(({ slot, slotSchema }) => (
  <textarea value={slot.value} onChange={evt => slot.set(evt.target.value)} />
))

const SlotEditor = inject('classes')(
  observer(({ slot, slotSchema, classes }) => {
    const { name, description, type, value } = slot
    const ValueComponent = /^\s*function\s*\(/.test(value)
      ? FunctionEditor
      : valueComponents[type] || StringValueComponent
    return (
      <div className={classes.slotContainer}>
        <div className={classes.slotName}>{name}</div>
        <div className={classes.description}>{description}</div>
        <ValueComponent slot={slot} slotSchema={slotSchema} />
      </div>
    )
  }),
)

export default SlotEditor
