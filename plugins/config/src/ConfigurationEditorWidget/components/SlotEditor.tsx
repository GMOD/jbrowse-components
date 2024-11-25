import React, { useEffect, useState } from 'react'
import { FileSelector } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { getSubType, getUnionSubTypes } from '@jbrowse/core/util/mst-reflection'

// icons
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import { IconButton, MenuItem, Paper, SvgIcon, TextField } from '@mui/material'
import { observer } from 'mobx-react'
import { getPropertyMembers } from 'mobx-state-tree'

// locals
import BooleanEditor from './BooleanEditor'
import CallbackEditor from './CallbackEditor'
import ColorEditor from './ColorEditor'
import ConfigurationTextField from './ConfigurationTextField'
import JsonEditor from './JsonEditor'
import NumberEditor from './NumberEditor'
import NumberMapEditor from './NumberMapEditor'
import StringArrayEditor from './StringArrayEditor'
import StringArrayMapEditor from './StringArrayMapEditor'
import { useSlotEditorStyles } from './useSlotEditorStyles'
import type {
  AnyConfigurationSlot,
  AnyConfigurationSlotType,
} from '@jbrowse/core/configuration'
import type { FileLocation } from '@jbrowse/core/util'
import type { ILiteralType } from '@jbrowse/core/util/mst-reflection'
import type { IAnyType } from 'mobx-state-tree'

const StringEditor = observer(function ({
  slot,
}: {
  slot: {
    name: string
    description: string
    value: string
    set: (arg: string) => void
  }
}) {
  return (
    <ConfigurationTextField
      label={slot.name}
      helperText={slot.description}
      value={slot.value}
      onChange={evt => {
        slot.set(evt.target.value)
      }}
    />
  )
})

const TextEditor = observer(function ({
  slot,
}: {
  slot: {
    name: string
    description: string
    value: string
    set: (arg: string) => void
  }
}) {
  return (
    <TextField
      label={slot.name}
      helperText={slot.description}
      multiline
      value={slot.value}
      onChange={evt => {
        slot.set(evt.target.value)
      }}
    />
  )
})

// checked checkbox, looks like a styled (x)
const SvgCheckbox = () => (
  <SvgIcon>
    <path d="M20.41,3C21.8,5.71 22.35,8.84 22,12C21.8,15.16 20.7,18.29 18.83,21L17.3,20C18.91,17.57 19.85,14.8 20,12C20.34,9.2 19.89,6.43 18.7,4L20.41,3M5.17,3L6.7,4C5.09,6.43 4.15,9.2 4,12C3.66,14.8 4.12,17.57 5.3,20L3.61,21C2.21,18.29 1.65,15.17 2,12C2.2,8.84 3.3,5.71 5.17,3M12.08,10.68L14.4,7.45H16.93L13.15,12.45L15.35,17.37H13.09L11.71,14L9.28,17.33H6.76L10.66,12.21L8.53,7.45H10.8L12.08,10.68Z" />
  </SvgIcon>
)

const IntegerEditor = observer(function ({
  slot,
}: {
  slot: {
    name: string
    value: string
    description: string
    set: (num: number) => void
  }
}) {
  const [val, setVal] = useState(slot.value)
  useEffect(() => {
    const num = Number.parseInt(val, 10)
    if (!Number.isNaN(num)) {
      slot.set(num)
    }
  }, [slot, val])
  return (
    <ConfigurationTextField
      label={slot.name}
      helperText={slot.description}
      value={val}
      type="number"
      onChange={evt => {
        setVal(evt.target.value)
      }}
    />
  )
})

const StringEnumEditor = observer(function ({
  slot,
  slotSchema,
}: {
  slot: AnyConfigurationSlot
  slotSchema: AnyConfigurationSlotType
}) {
  const p = getPropertyMembers(getSubType(slotSchema))
  const choices = getUnionSubTypes(
    getUnionSubTypes(getSubType(p.properties.value!))[1]!,
  ).map(t => (t as ILiteralType<string>).value)

  return (
    <ConfigurationTextField
      value={slot.value}
      label={slot.name}
      select
      helperText={slot.description}
      onChange={evt => {
        slot.set(evt.target.value)
      }}
    >
      {choices.map(str => (
        <MenuItem key={str} value={str}>
          {str}
        </MenuItem>
      ))}
    </ConfigurationTextField>
  )
})

const FileSelectorWrapper = observer(function ({
  slot,
}: {
  slot: {
    name: string
    value: FileLocation
    set: (arg: FileLocation) => void
    description: string
  }
}) {
  return (
    <FileSelector
      location={slot.value}
      setLocation={location => {
        slot.set(location)
      }}
      name={slot.name}
      description={slot.description}
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      rootModel={getEnv(slot).pluginManager?.rootModel}
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
  stringEnum: StringEnumEditor,
  boolean: BooleanEditor,
  frozen: JsonEditor,
  configRelationships: JsonEditor,
}

const SlotEditor = observer(function ({
  slot,
  slotSchema,
}: {
  slot: any
  slotSchema: IAnyType
}) {
  const { classes } = useSlotEditorStyles()
  const { type } = slot
  let ValueComponent = slot.isCallback
    ? CallbackEditor
    : // @ts-expect-error
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
              slot.isCallback ? slot.convertToValue() : slot.convertToCallback()
            }
            title={`convert to ${
              slot.isCallback ? 'regular value' : 'callback'
            }`}
          >
            {slot.isCallback ? <SvgCheckbox /> : <RadioButtonUncheckedIcon />}
          </IconButton>
        ) : null}
      </div>
    </Paper>
  )
})

export default SlotEditor
