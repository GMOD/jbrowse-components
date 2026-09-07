import {
  SCROLL_ZOOM_HELP,
  SCROLL_ZOOM_LABEL,
} from '@jbrowse/core/ui/scrollZoomLabels'
import { FormGroup } from '@mui/material'
import { observer } from 'mobx-react'

import PreferenceCheckbox from './PreferenceCheckbox.tsx'

export interface ViewPreferencesSession {
  scrollZoom: boolean
  // the session setter rather than a plain override: it also stops offering
  // the scroll-to-zoom prompt
  setScrollZoom: (flag: boolean) => void
  stickyViewHeaders: boolean
  setStickyViewHeaders: (sticky: boolean) => void
  effectiveUseWorkspaces: boolean
  setUseWorkspacesPreference: (useWorkspaces: boolean) => void
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
        label={SCROLL_ZOOM_LABEL}
        help={SCROLL_ZOOM_HELP}
        onChange={checked => {
          session.setScrollZoom(checked)
        }}
      />
      <PreferenceCheckbox
        checked={session.stickyViewHeaders}
        label="Keep view header visible"
        help="The view header stays at the top of the page while its tracks scroll under it."
        onChange={checked => {
          session.setStickyViewHeaders(checked)
        }}
      />
      <PreferenceCheckbox
        checked={session.effectiveUseWorkspaces}
        label="Use workspaces"
        help="Views open as tabs and tiles instead of stacking down the page."
        onChange={checked => {
          session.setUseWorkspacesPreference(checked)
        }}
      />
    </FormGroup>
  )
})

export default ViewPreferencesTab
