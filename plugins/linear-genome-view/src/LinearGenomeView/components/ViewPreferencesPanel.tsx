import { useSyncExternalStore } from 'react'

import { LabeledCheckbox } from '@jbrowse/core/ui'
import { subscribeToLocalStorageKey } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { VIEW_TRACK_LABEL_MODES } from '@jbrowse/display-kit/types'
import { FormGroup, MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import {
  LGV_TOGGLES,
  TRACK_LABELS_KEY,
  configTrackLabels,
  lgvViews,
  setToggle,
  setTrackLabels,
  storedToggle,
  storedTrackLabels,
} from '../viewPreferences.ts'

import type { LgvToggle } from '../viewPreferences.ts'

const useStyles = makeStyles()({
  field: {
    marginTop: 8,
    marginBottom: 8,
    display: 'block',
  },
})

function useStored<T>(key: string, read: () => T) {
  return useSyncExternalStore(
    onChange => subscribeToLocalStorageKey(key, onChange),
    read,
  )
}

const ToggleRow = observer(function ToggleRow({
  session,
  toggle,
}: {
  session: unknown
  toggle: LgvToggle
}) {
  const checked = useStored(toggle.key, () => storedToggle(toggle.key))
  return (
    <LabeledCheckbox
      checked={checked}
      onChange={flag => {
        setToggle(lgvViews(session), toggle.key, flag)
      }}
      label={toggle.label}
    />
  )
})

const ViewPreferencesPanel = observer(function ViewPreferencesPanel({
  session,
}: {
  session: unknown
}) {
  const { classes } = useStyles()
  const configDefault = configTrackLabels(session)
  const trackLabels = useStored(TRACK_LABELS_KEY, storedTrackLabels)
  return (
    <>
      <TextField
        select
        variant="outlined"
        className={classes.field}
        label="Track labels"
        value={trackLabels || configDefault}
        onChange={event => {
          const mode = VIEW_TRACK_LABEL_MODES.find(
            m => m === event.target.value,
          )
          if (mode) {
            setTrackLabels(
              lgvViews(session),
              mode === configDefault ? '' : mode,
              configDefault,
            )
          }
        }}
      >
        {VIEW_TRACK_LABEL_MODES.map(mode => (
          <MenuItem key={mode} value={mode}>
            {mode[0]!.toUpperCase() + mode.slice(1)}
          </MenuItem>
        ))}
      </TextField>
      <FormGroup>
        {LGV_TOGGLES.map(toggle => (
          <ToggleRow key={toggle.key} session={session} toggle={toggle} />
        ))}
      </FormGroup>
    </>
  )
})

export default ViewPreferencesPanel
