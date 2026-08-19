import { useState } from 'react'

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
import IntegerEditor from './IntegerEditor.tsx'
import JsonEditor from './JsonEditor.tsx'
import NumberEditor from './NumberEditor.tsx'
import NumberMapEditor from './NumberMapEditor.tsx'
import StringArrayEditor from './StringArrayEditor.tsx'
import StringArrayMapEditor from './StringArrayMapEditor.tsx'
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

/** #slotEditor single-line text field */
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
    // a `maybeStringEnum` slot is undefined when unset — the inherit state of a
    // promotable slot, which the extra leading choice below both shows and sets
    value: string | undefined
    type: string
    description: string
    // what unset resolves to on a promotable slot, absent on a plain one
    promotedBase?: unknown
    choices?: string[]
    set: (arg: string | undefined) => void
  }
}) {
  const nullable = slot.type === 'maybeStringEnum'
  // Naming the member unset resolves to, rather than a bare "default": every
  // other choice in the list is a value the user can read off the plot, and
  // this one was the only one that said nothing about what picking it draws.
  // `promotedBase` is the honest half to show — the editor's target is often a
  // detached config node, so it cannot see a value promoted this session.
  const unsetLabel =
    typeof slot.promotedBase === 'string'
      ? `default (${slot.promotedBase})`
      : 'default'
  return (
    <ConfigurationTextField
      value={slot.value ?? UNSET_CHOICE}
      label={slot.name}
      select
      helperText={slot.description}
      onChange={evt => {
        const { value } = evt.target
        slot.set(value === UNSET_CHOICE ? undefined : value)
      }}
    >
      {nullable ? (
        <MenuItem value={UNSET_CHOICE}>
          <em>{unsetLabel}</em>
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
    value: FileLocation
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

// dynamic dispatch from a runtime slot `type` string to a typed editor. The
// `any` is irreducible here: each editor declares a narrow `slot.value` type
// (number, boolean, FileLocation, string[], ...) but makeSlotFacade can only
// type value as `unknown`, so no single registry prop type satisfies them all.
// The editors stay fully typed internally; only this lookup is untyped.
const valueComponents: Record<string, React.ComponentType<any>> = {
  string: StringEditor,
  text: TextEditor,
  fileLocation: FileSelectorWrapper,
  stringArray: StringArrayEditor,
  stringArrayMap: StringArrayMapEditor,
  numberMap: NumberMapEditor,
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
}

const SlotEditor = observer(function SlotEditor({
  slot,
}: {
  slot: SlotFacade
}) {
  const { classes } = useSlotEditorStyles()
  const { type } = slot
  // editor mode is UI-only state, derived once from whether the stored value is
  // a jexl callback. Toggling rewrites the value; typing a "jexl:" prefix into a
  // value field does not auto-swap the editor, since this state only changes on
  // the explicit toggle.
  const [callbackMode, setCallbackMode] = useState(() =>
    isCallbackValue(slot.value),
  )
  // bumped on reset to remount the value editor: the buffered editors (number,
  // json, callback) seed internal state from slot.value only on mount, so an
  // external set wouldn't otherwise show in the field
  const [resetNonce, setResetNonce] = useState(0)
  const TypedComponent = valueComponents[type]
  if (!callbackMode && !TypedComponent) {
    console.warn(`no slot editor defined for ${type}, editing as string`)
  }
  const ValueComponent: React.ComponentType<any> = callbackMode
    ? CallbackEditor
    : (TypedComponent ?? StringEditor)
  // a promotable slot's default is its inherit sentinel, so resetting it here
  // doubles as "un-pin / follow the session-wide default"
  const { modified } = slot
  return (
    <Paper className={classes.paper}>
      <div className={classes.paperContent}>
        <ValueComponent key={resetNonce} slot={slot} />
      </div>
      {modified ? (
        <div className={classes.resetButton}>
          <Tooltip title="Reset to default">
            <IconButton
              aria-label="reset to default"
              onClick={() => {
                slot.set(slot.defaultValue)
                setCallbackMode(isCallbackValue(slot.defaultValue))
                setResetNonce(nonce => nonce + 1)
              }}
            >
              <RestartAltIcon />
            </IconButton>
          </Tooltip>
        </div>
      ) : null}
      {slot.contextVariable.length ? (
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
                if (callbackMode) {
                  slot.set(
                    toFixedValue(
                      slot.value,
                      type,
                      slot.defaultValue,
                      slot.pluginManager.jexl,
                    ),
                  )
                  setCallbackMode(false)
                } else {
                  slot.set(toCallbackValue(slot.value))
                  setCallbackMode(true)
                }
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
