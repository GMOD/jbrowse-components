import { FileSelector } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { getSubType, getUnionSubTypes } from '@jbrowse/core/util/mst-reflection'
import { getPropertyMembers } from '@jbrowse/mobx-state-tree'
import CodeIcon from '@mui/icons-material/Code'
import { IconButton, MenuItem, Paper, TextField, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import BooleanEditor from './BooleanEditor.tsx'
import CallbackEditor from './CallbackEditor.tsx'
import ColorEditor from './ColorEditor.tsx'
import ConfigurationTextField from './ConfigurationTextField.tsx'
import IntegerEditor from './IntegerEditor.tsx'
import JsonEditor from './JsonEditor.tsx'
import NumberEditor from './NumberEditor.tsx'
import NumberMapEditor from './NumberMapEditor.tsx'
import StringArrayEditor from './StringArrayEditor.tsx'
import StringArrayMapEditor from './StringArrayMapEditor.tsx'
import { useSlotEditorStyles } from './useSlotEditorStyles.ts'

import type {
  AnyConfigurationSlot,
  AnyConfigurationSlotType,
} from '@jbrowse/core/configuration'
import type { FileLocation } from '@jbrowse/core/util'
import type { ILiteralType } from '@jbrowse/core/util/mst-reflection'
import type { IAnyType } from '@jbrowse/mobx-state-tree'

interface StringSlot {
  name: string
  description: string
  value: string
  set: (arg: string) => void
}

const StringEditor = observer(function StringEditor({
  slot,
}: {
  slot: StringSlot
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

const TextEditor = observer(function TextEditor({
  slot,
}: {
  slot: StringSlot
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

const StringEnumEditor = observer(function StringEnumEditor({
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

const FileSelectorWrapper = observer(function FileSelectorWrapper({
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
      rootModel={getEnv(slot).pluginManager.rootModel}
    />
  )
})

const valueComponents: Record<string, React.ComponentType<any>> = {
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

const SlotEditor = observer(function SlotEditor({
  slot,
  slotSchema,
}: {
  slot: any
  slotSchema: IAnyType
}) {
  const { classes } = useSlotEditorStyles()
  const { type } = slot
  const TypedComponent = valueComponents[type]
  if (!slot.editorIsCallback && !TypedComponent) {
    console.warn(`no slot editor defined for ${type}, editing as string`)
  }
  const ValueComponent: React.ComponentType<any> = slot.editorIsCallback
    ? CallbackEditor
    : (TypedComponent ?? StringEditor)
  return (
    <Paper className={classes.paper}>
      <div className={classes.paperContent}>
        <ValueComponent slot={slot} slotSchema={slotSchema} />
      </div>
      {slot.contextVariable.length ? (
        <div className={classes.slotModeSwitch}>
          <Tooltip
            title={
              slot.editorIsCallback
                ? 'Editing as a callback (Jexl expression). Click to use a fixed value.'
                : 'Editing as a fixed value. Click to use a callback (Jexl expression).'
            }
          >
            <IconButton
              color={slot.editorIsCallback ? 'primary' : 'default'}
              onClick={() =>
                slot.editorIsCallback
                  ? slot.convertToValue()
                  : slot.convertToCallback()
              }
            >
              <CodeIcon />
            </IconButton>
          </Tooltip>
        </div>
      ) : null}
    </Paper>
  )
})

export default SlotEditor
