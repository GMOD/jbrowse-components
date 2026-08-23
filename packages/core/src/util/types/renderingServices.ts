import type assemblyManager from '../../assemblyManager/index.ts'
import type { PaletteHost, RpcHost } from './services.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// The assembly manager is the one service whose type is application-sized: it
// is an MST model a `PluginManager` builds, so naming it puts the configuration
// schemas and the plugin manager in the caller's type graph no matter how
// little of it the caller uses. It sits here rather than in `./services.ts` so
// that the notification, dialog and RPC slices next door stay cheap to name.

export type AssemblyManager = Instance<ReturnType<typeof assemblyManager>>

export interface AssemblyHost {
  assemblyManager: AssemblyManager
  /**
   * the assemblies this host offers, which is not the same set the manager can
   * resolve: an assembly reachable through a track's config is not one a picker
   * should list.
   */
  assemblyNames: string[]
}

/** what a display needs of its host in order to draw a region */
export interface RenderingServices extends AssemblyHost, RpcHost, PaletteHost {}
