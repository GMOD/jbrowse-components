import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'
import { observer } from 'mobx-react'

import DisplayUIProvider from '../DisplayUIProvider.tsx'
import { Notifications } from './notifications.tsx'

import type { DisplayChromeOverlays } from '../chromeOverlays.ts'
import type { TrackControlComponent } from '../trackControl/types.ts'
import type { NotificationsSession } from './notifications.tsx'
import type { ThemeModeSession } from '@jbrowse/core/ui/PaletteContext'
import type React from 'react'

export const EmbedProvider = observer(function EmbedProvider({
  session,
  mode,
  overlays,
  trackControl,
  notifications = true,
  children,
}: {
  session: ThemeModeSession & NotificationsSession
  mode?: 'light' | 'dark'
  overlays?: Partial<DisplayChromeOverlays>
  trackControl?: TrackControlComponent
  notifications?: boolean
  children: React.ReactNode
}) {
  return (
    <SessionPaletteProvider session={session} mode={mode}>
      <DisplayUIProvider overlays={overlays} trackControl={trackControl}>
        {children}
        {notifications ? <Notifications session={session} /> : null}
      </DisplayUIProvider>
    </SessionPaletteProvider>
  )
})
