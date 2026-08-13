import { LabeledCheckbox } from '@jbrowse/core/ui'
import { FormControl, FormHelperText } from '@mui/material'
import { observer } from 'mobx-react'

/** #slotEditor checkbox */
const BooleanEditor = observer(function BooleanEditor({
  slot,
}: {
  slot: {
    name: string
    // maybeBoolean slots start undefined (the promotable "inherit" state); the
    // checkbox coerces to a concrete boolean so it stays controlled
    value: boolean | undefined
    // what unset resolves to on a promotable slot, absent on a plain one
    promotedBase?: unknown
    set: (arg: boolean) => void
    description: string
  }
}) {
  return (
    <FormControl>
      <LabeledCheckbox
        label={slot.name}
        // An unset promotable slot renders its `promotedBase`, not `false`.
        // Coercing every unset slot to unchecked mis-stated the three whose
        // base is `true` (displayDirectionalChevrons, showSashimiArcs,
        // readConnectionsDown): the box read unchecked on a track that was
        // drawing chevrons, and ticking it wrote the value the track already
        // had — no visible change, but the slot silently left the cascade and
        // stopped following later session-wide defaults. The reset button
        // (SlotEditor's `modified`) is what still separates inherited from
        // customized; this only fixes which state is *shown*. The session tier
        // is out of reach here, so a value promoted this session isn't
        // reflected — see agent-docs/ideas/config-cleanups-declined.md.
        checked={slot.value ?? !!slot.promotedBase}
        onChange={val => {
          slot.set(val)
        }}
      />
      <FormHelperText>{slot.description}</FormHelperText>
    </FormControl>
  )
})

export default BooleanEditor
