import { knownInitKeys } from '../LinearGenomeView/afterAttach.ts'

import type {
  InitState,
  LinearGenomeViewLaunchProps,
} from '../LinearGenomeView/types.ts'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// the launch args are the declarative InitState (with assembly relaxed to
// optional, since it's validated at runtime below) plus plain persisted view
// props and the target session. An optional `id` lets a session spec pin the
// created view's id so another view (e.g. a connected MsaView) can reference it
// via connectedViewId.
export type LaunchLinearGenomeViewArgs = Partial<InitState> &
  LinearGenomeViewLaunchProps & {
    session: AbstractSessionModel
    id?: string
  }

// Plain persisted view props LaunchView forwards straight onto the view
// snapshot (see LinearGenomeViewLaunchProps). Exhaustive Record so adding a prop
// to the interface without listing it here is a compile error, not a key that
// silently warns as "unknown".
const knownLaunchPropMap: Record<keyof LinearGenomeViewLaunchProps, true> = {
  showCenterLine: true,
  trackLabels: true,
  colorByCDS: true,
  showHighlightChips: true,
}
const knownLaunchPropKeys = new Set(Object.keys(knownLaunchPropMap))

declare module '@jbrowse/core/PluginManager' {
  interface ExtensionPointRegistry {
    'LaunchView-LinearGenomeView': {
      args: LaunchLinearGenomeViewArgs
      result: LaunchLinearGenomeViewArgs
    }
  }
}

export default function LaunchLinearGenomeViewF(pluginManager: PluginManager) {
  /** #extensionPoint LaunchView-LinearGenomeView | async | Programmatically launch a linear genome view */
  pluginManager.addToExtensionPoint('LaunchView-LinearGenomeView', args => {
    const { session, id, ...spec } = args
    if (!spec.assembly) {
      throw new Error('No assembly provided when launching linear genome view')
    }
    // Split the spec: resolution keys (loc, tracks, highlight, …) go into the
    // one-shot `init` blob that afterAttach applies then discards; plain
    // persisted props (showCenterLine, colorByCDS, …) go straight onto the view
    // snapshot, where MST restores them natively. MST silently drops unknown
    // snapshot keys, so anything in neither set is a typo — warn rather than
    // swallow it.
    const init: Record<string, unknown> = {}
    const viewProps: Record<string, unknown> = {}
    const unknown: string[] = []
    for (const [key, value] of Object.entries(spec)) {
      if (knownInitKeys.has(key)) {
        init[key] = value
      } else if (knownLaunchPropKeys.has(key)) {
        viewProps[key] = value
      } else {
        unknown.push(key)
      }
    }
    if (unknown.length) {
      console.warn(
        `LaunchView-LinearGenomeView ignored unknown key(s): ${unknown.join(', ')}`,
      )
    }
    // A provided id is passed top-level so MST's optional identifier honors it
    // (undefined falls back to an auto-generated id).
    session.addView('LinearGenomeView', { id, ...viewProps, init })
    return args
  })
}
