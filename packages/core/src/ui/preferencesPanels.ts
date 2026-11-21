import type { TrackConfigChange } from '../util/trackConfigDelta.ts'
import type React from 'react'

/**
 * A preference held outside the session's override map, with its own default
 * and reset, so "Reset to defaults" lists and reverts it with the rest. The
 * map's row for the same `head` is dropped in favour of this one.
 */
export interface ResettablePreference<Session = unknown> {
  head: string
  change: (session: Session) => TrackConfigChange | undefined
  reset: (session: Session) => void
}

/**
 * A tab a plugin adds to the Preferences dialog, labeled by `name`. The
 * session is the app's; narrow it to what the panel reads.
 */
export interface PreferencesPanelDescriptor {
  name: string
  Component: React.ComponentType<{ session: unknown }>
  resettable?: readonly ResettablePreference[]
}

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'Core-preferencesDialogPanels': {
      args: PreferencesPanelDescriptor[]
      result: PreferencesPanelDescriptor[]
      props: { session: unknown }
    }
  }
}
