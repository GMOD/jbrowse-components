import { SessionPaletteProvider } from '@jbrowse/core/ui/PaletteContext'

import DisplayUIProvider from '../DisplayUIProvider.tsx'

import type { DisplayChromeOverlays } from '../chromeOverlays.ts'
import type { TrackControlComponent } from '../trackControl/types.ts'
import type { ThemeModeSession } from '@jbrowse/core/ui/PaletteContext'
import type React from 'react'

export function EmbedProvider({
  session,
  mode,
  overlays,
  trackControl,
  children,
}: {
  session: ThemeModeSession
  mode?: 'light' | 'dark'
  overlays?: Partial<DisplayChromeOverlays>
  trackControl?: TrackControlComponent
  children: React.ReactNode
}) {
  return (
    <SessionPaletteProvider session={session} mode={mode}>
      <DisplayUIProvider overlays={overlays} trackControl={trackControl}>
        {children}
      </DisplayUIProvider>
    </SessionPaletteProvider>
  )
}
