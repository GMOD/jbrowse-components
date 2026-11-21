import { SCROLL_ZOOM_HELP } from '@jbrowse/core/ui/scrollZoomLabels'
import { FormGroup } from '@mui/material'
import { observer } from 'mobx-react'

import PreferenceCheckbox from './PreferenceCheckbox.tsx'
import { PREFERENCE_LABELS } from './preferenceLabels.ts'

export interface ViewPreferencesSession {
  scrollZoom: boolean
  // the session setter rather than a plain override: it also stops offering
  // the scroll-to-zoom prompt
  setScrollZoom: (flag: boolean) => void
  stickyViewHeaders: boolean
  setStickyViewHeaders: (sticky: boolean) => void
  getPreference: (key: string) => unknown
  setPreferenceOverride: (key: string, value: unknown) => void
}

const ViewPreferencesTab = observer(function ViewPreferencesTab({
  session,
}: {
  session: ViewPreferencesSession
}) {
  return (
    <FormGroup>
      <PreferenceCheckbox
        checked={session.scrollZoom}
        label={PREFERENCE_LABELS.scrollZoom}
        help={SCROLL_ZOOM_HELP}
        onChange={checked => {
          session.setScrollZoom(checked)
        }}
      />
      <PreferenceCheckbox
        checked={session.stickyViewHeaders}
        label={PREFERENCE_LABELS.stickyViewHeaders}
        help="The view header stays at the top of the page while its tracks scroll under it."
        onChange={checked => {
          session.setStickyViewHeaders(checked)
        }}
      />
      <PreferenceCheckbox
        checked={session.getPreference('showBandChips') !== false}
        label={PREFERENCE_LABELS.showBandChips}
        help="Chips such as Coverage × and Pileup × over the top-left of each band of an alignments or MAF track. The track menu shows and hides bands either way."
        onChange={checked => {
          session.setPreferenceOverride('showBandChips', checked)
        }}
      />
    </FormGroup>
  )
})

export default ViewPreferencesTab
