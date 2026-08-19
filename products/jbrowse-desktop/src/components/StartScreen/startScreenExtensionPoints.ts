import type PluginManager from '@jbrowse/core/PluginManager'
import type { MenuItem } from '@jbrowse/core/ui'

// What a start screen extension needs to open a session itself:
// loadPluginManager builds the manager for a config path, setPluginManager
// hands it to the app. The panels' own props are a subset of this, so one shape
// covers both panel points.
export interface StartScreenPanelProps {
  setPluginManager: (arg: PluginManager) => void
  loadPluginManager: (configPath: string) => Promise<PluginManager>
}

export interface StartScreenMenuItemsProps extends StartScreenPanelProps {
  pluginManager: PluginManager
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
      props: StartScreenMenuItemsProps
    }
    /** #extensionPoint Desktop-StartScreenLaunchPanel | sync | Replace or wrap the "Launch new session" panel */
    'Desktop-StartScreenLaunchPanel': ComponentSlot<StartScreenPanelProps>
    /** #extensionPoint Desktop-StartScreenRecentSessionsPanel | sync | Replace or wrap the recent sessions panel */
    'Desktop-StartScreenRecentSessionsPanel': ComponentSlot<StartScreenPanelProps>
  }
}
