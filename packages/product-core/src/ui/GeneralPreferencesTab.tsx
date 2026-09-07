import { makeStyles } from '@jbrowse/core/util/tss-react'
import { FormGroup, MenuItem, TextField } from '@mui/material'
import { observer } from 'mobx-react'

import PreferenceCheckbox from './PreferenceCheckbox.tsx'

import type { ThemeMap } from '@jbrowse/core/ui'
import type { AnimationMode } from '@jbrowse/core/util'

const useStyles = makeStyles()({
  field: {
    marginTop: 16,
    display: 'block',
  },
})

export interface GeneralPreferencesSession {
  allThemes: () => ThemeMap
  themeName?: string
  setThemeName: (arg: string) => void
  animationMode: AnimationMode
  numberGrouping: boolean
  setPreferenceOverride: (key: string, value: unknown) => void
}

const ANIMATION_MODES: { value: AnimationMode; label: string }[] = [
  { value: 'system', label: 'Follow system (reduced motion)' },
  { value: 'enabled', label: 'Always on' },
  { value: 'disabled', label: 'Off' },
]

const GeneralPreferencesTab = observer(function GeneralPreferencesTab({
  session,
}: {
  session: GeneralPreferencesSession
}) {
  const { classes } = useStyles()
  return (
    <>
      <TextField
        select
        variant="outlined"
        className={classes.field}
        label="Theme"
        value={session.themeName}
        onChange={event => {
          session.setThemeName(event.target.value)
        }}
      >
        {Object.entries(session.allThemes()).map(([key, val]) => (
          <MenuItem key={key} value={key}>
            {val.name || '(Unknown name)'}
          </MenuItem>
        ))}
      </TextField>
      <TextField
        select
        variant="outlined"
        className={classes.field}
        label="Animations"
        value={session.animationMode}
        onChange={event => {
          session.setPreferenceOverride('animationMode', event.target.value)
        }}
      >
        {ANIMATION_MODES.map(opt => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </TextField>
      <FormGroup>
        <PreferenceCheckbox
          checked={session.numberGrouping}
          label="Thousand separators in numbers"
          help="Shows chr1:1,234,567 rather than chr1:1234567. Takes effect after reloading the page."
          onChange={checked => {
            session.setPreferenceOverride('numberGrouping', checked)
          }}
        />
      </FormGroup>
    </>
  )
})

export default GeneralPreferencesTab
