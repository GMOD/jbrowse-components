import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { observer } from 'mobx-react'

import DisplayUIProvider from '../DisplayUIProvider.tsx'
import { Notifications } from './notifications.tsx'

import type { DisplayChromeOverlays } from '../chromeOverlays.ts'
import type { TrackControlComponent } from '../trackControl/types.ts'
import type { NotificationsSession } from './notifications.tsx'
import type { ThemeModeSession } from '@jbrowse/core/ui/PaletteContext'
import type React from 'react'

/**
 * Which chrome a display draws around its data. `plain` (the default) is the
 * toolkit-free set, with `overlays` and `trackControl` replacing parts of it;
 * `material` is JBrowse's own Material UI chrome, which the stock displays
 * bind themselves, so it takes no parts.
 */
export type EmbedChrome =
  | {
      chrome?: 'plain'
      overlays?: Partial<DisplayChromeOverlays>
      trackControl?: TrackControlComponent
    }
  | { chrome: 'material'; overlays?: never; trackControl?: never }

export const EmbedProvider = observer(function EmbedProvider({
  session,
  mode,
  notifications = true,
  children,
  ...chrome
}: {
  session: ThemeModeSession & NotificationsSession
  mode?: 'light' | 'dark'
  notifications?: boolean
  children: React.ReactNode
} & EmbedChrome) {
  const body = (
    <>
      {children}
      {notifications ? <Notifications session={session} /> : null}
    </>
  )
  return (
    <SessionPaletteProvider session={session} mode={mode}>
      {chrome.chrome === 'material' ? (
        body
      ) : (
        <DisplayUIProvider
          overlays={chrome.overlays}
          trackControl={chrome.trackControl}
        >
          {body}
        </DisplayUIProvider>
      )}
    </SessionPaletteProvider>
  )
})
