import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'
import type { ComponentType } from 'react'

// Both start screen panels take the same prop, so one shape covers both points
export interface StartScreenPanelProps {
  setPluginManager: (arg: PluginManager) => void
}

// The start screen runs before any session exists, so these points fire on the
// global-plugins-only manager from createStartScreenPluginManager rather than a
// session's.
declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    /** #extensionPoint Desktop-StartScreenMenuItems | sync | Add items to the start screen menu */
    'Desktop-StartScreenMenuItems': {
      args: MenuItem[]
      result: MenuItem[]
      props: { pluginManager: PluginManager }
    }
    /** #extensionPoint Desktop-StartScreenLaunchPanel | sync | Replace or wrap the "Launch new session" panel */
    'Desktop-StartScreenLaunchPanel': {
      args: ComponentType<StartScreenPanelProps>
      result: ComponentType<StartScreenPanelProps>
      props: StartScreenPanelProps
    }
    /** #extensionPoint Desktop-StartScreenRecentSessionsPanel | sync | Replace or wrap the recent sessions panel */
    'Desktop-StartScreenRecentSessionsPanel': {
      args: ComponentType<StartScreenPanelProps>
      result: ComponentType<StartScreenPanelProps>
      props: StartScreenPanelProps
    }
  }
}
