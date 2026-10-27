import {
  isCallbackValue,
  toCallbackValue,
  toFixedValue,
} from '@jbrowse/core/configuration'
import { FileSelector } from '@jbrowse/core/ui'
import CodeIcon from '@mui/icons-material/Code'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { IconButton, MenuItem, Paper, TextField, Tooltip } from '@mui/material'
import { observer } from 'mobx-react'

import BooleanEditor from './BooleanEditor.tsx'
import CallbackEditor from './CallbackEditor.tsx'
import ColorEditor from './ColorEditor.tsx'
import ConfigurationTextField from './ConfigurationTextField.tsx'
import { ColorArrayEditor, StringEnumArrayEditor } from './EntryListEditor.tsx'
import IntegerEditor from './IntegerEditor.tsx'
import JsonEditor from './JsonEditor.tsx'
import NumberEditor from './NumberEditor.tsx'
import NumberMapEditor from './NumberMapEditor.tsx'
import StringArrayEditor, {
  ExpressionArrayEditor,
} from './StringArrayEditor.tsx'
import StringArrayMapEditor from './StringArrayMapEditor.tsx'
import StringMapEditor from './StringMapEditor.tsx'
import { useSlotEditorStyles } from './useSlotEditorStyles.ts'

import type PluginManager from '@jbrowse/core/PluginManager'
import type { SlotFacade } from '@jbrowse/core/configuration'
import type { FileLocation } from '@jbrowse/core/util'

interface StringSlot {
  name: string
  description: string
  value: string
  set: (arg: string) => void
}

// Also drives `maybeString`, whose value is `undefined` while unset: clearing
// the field leaves the empty string, which is a value, and the reset button
// returns the slot to unset.
/** #slotEditor single-line text field */
const StringEditor = observer(function StringEditor({
  slot,
}: {
  slot: Omit<StringSlot, 'value'> & { value: string | undefined }
}) {
  return (
    <ConfigurationTextField
      label={slot.name}
      helperText={slot.description}
      value={slot.value ?? ''}
      onChange={evt => {
        slot.set(evt.target.value)
      }}
    />
  )
})

/** #slotEditor multi-line textarea */
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

// Sentinel for "leave the slot unset" in the maybe-enum dropdown. MUI needs a
// concrete option value, and '' can't collide with an enum member (an empty
// enumeration member would be unnameable in a menu anyway).
const UNSET_CHOICE = ''

/** #slotEditor dropdown of the `model`'s members */
const StringEnumEditor = observer(function StringEnumEditor({
  slot,
}: {
  slot: {
    name: string
    // a `maybeStringEnum` slot is undefined when unset, which the extra leading
    // choice below both shows and sets
    value: string | undefined
    type: string
    description: string
    choices?: string[]
    set: (arg: string | undefined) => void
  }
}) {
  const nullable = slot.type === 'maybeStringEnum'
  return (
    <ConfigurationTextField
      value={slot.value ?? UNSET_CHOICE}
      label={slot.name}
      select
      slotProps={
        nullable
          ? { select: { displayEmpty: true }, inputLabel: { shrink: true } }
          : undefined
      }
      helperText={slot.description}
      onChange={evt => {
        const { value } = evt.target
        slot.set(value === UNSET_CHOICE ? undefined : value)
      }}
    >
      {nullable ? (
        <MenuItem value={UNSET_CHOICE}>
          <em>default</em>
        </MenuItem>
      ) : null}
      {(slot.choices ?? []).map(str => (
        <MenuItem key={str} value={str}>
          {str}
        </MenuItem>
      ))}
    </ConfigurationTextField>
  )
})

/** #slotEditor URL, local file path (desktop) or file blob (browser) */
const FileSelectorWrapper = observer(function FileSelectorWrapper({
  slot,
}: {
  slot: {
    name: string
    value: FileLocation | undefined
    set: (arg: FileLocation) => void
    description: string
    pluginManager: PluginManager
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
      rootModel={slot.pluginManager.rootModel}
    />
  )
})

// The `any` is irreducible: each editor declares a narrow `slot.value` type, but
// makeSlotFacade can only type value as `unknown`. The keys are checked: a slot
// type with no editor is a compile error.
const valueComponents = {
  string: StringEditor,
  maybeString: StringEditor,
  featureField: StringEditor,
  text: TextEditor,
  fileLocation: FileSelectorWrapper,
  maybeFileLocation: FileSelectorWrapper,
  stringArray: StringArrayEditor,
  expressionArray: ExpressionArrayEditor,
  colorArray: ColorArrayEditor,
  stringEnumArray: StringEnumArrayEditor,
  stringArrayMap: StringArrayMapEditor,
  numberMap: NumberMapEditor,
  stringMap: StringMapEditor,
  number: NumberEditor,
  maybeNumber: NumberEditor,
  integer: IntegerEditor,
  color: ColorEditor,
  maybeColor: ColorEditor,
  stringEnum: StringEnumEditor,
  maybeStringEnum: StringEnumEditor,
  boolean: BooleanEditor,
  maybeBoolean: BooleanEditor,
  frozen: JsonEditor,
  maybeFrozen: JsonEditor,
} satisfies Record<SlotFacade['type'], React.ComponentType<any>>

const SlotEditor = observer(function SlotEditor({
  slot,
}: {
  slot: SlotFacade
}) {
  const { classes } = useSlotEditorStyles()
  const { type, modified } = slot
  // A featureField's `jexl:` expression is a field, typed in its own text
  // field, since a featureField declares no contextVariable.
  const callback = slot.contextVariable.length > 0
  const callbackMode = callback && isCallbackValue(slot.value)
  const ValueComponent: React.ComponentType<any> = callbackMode
    ? CallbackEditor
    : valueComponents[type]
  const resetLabel = slot.resetsToBase
    ? "Reset to the track's config"
    : 'Reset to default'
  return (
    <Paper className={classes.paper}>
      <div className={classes.paperContent}>
        <ValueComponent slot={slot} />
      </div>
      {modified ? (
        <div className={classes.resetButton}>
          <Tooltip title={resetLabel}>
            <IconButton
              aria-label={resetLabel}
              onClick={() => {
                slot.set(slot.resetValue)
              }}
            >
              <RestartAltIcon />
            </IconButton>
          </Tooltip>
        </div>
      ) : null}
      {callback ? (
        <div className={classes.slotModeSwitch}>
          <Tooltip
            title={
              callbackMode
                ? 'Editing as a callback (Jexl expression). Click to use a fixed value.'
                : 'Editing as a fixed value. Click to use a callback (Jexl expression).'
            }
          >
            <IconButton
              color={callbackMode ? 'primary' : 'default'}
              onClick={() => {
                slot.set(
                  callbackMode
                    ? toFixedValue(
                        slot.value,
                        type,
                        slot.defaultValue,
                        slot.pluginManager.jexl,
                      )
                    : toCallbackValue(slot.value),
                )
              }}
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
