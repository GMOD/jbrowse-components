import type PluginManager from '../PluginManager.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ComponentType } from 'react'

/**
 * The slice of the add-track widget model an adapter-specific picker gets. It
 * is deliberately narrower than the widget's own model: a picker reads which
 * adapter is selected and contributes config fragments through `mixinData`,
 * which the widget merges into the track config on submit.
 */
export interface AddTrackComponentModel extends IAnyStateTreeNode {
  assembly: string | undefined
  setAssembly: (arg: string) => void
  trackAdapterType: string | undefined
  mixinData: Record<string, unknown>
  setMixinData: (data: Record<string, unknown>) => void
}

export interface AddTrackComponentProps {
  model: AddTrackComponentModel
}

// Singular: one picker renders below the adapter/track-type selectors, so this
// is a single-component fold rather than an array. A callback returns its own
// component when the selected adapter is one it handles, and the accumulated
// component otherwise.
declare module '../PluginManager.ts' {
  interface ExtensionPointRegistry {
    'Core-addTrackComponent': {
      args: ComponentType<AddTrackComponentProps>
      result: ComponentType<AddTrackComponentProps>
      props: AddTrackComponentProps
    }
  }
}

/**
 * Show `component` in the add-track widget whenever the selected adapter is one
 * of `adapterTypes`. Wraps `Core-addTrackComponent` so a plugin states only
 * which adapters it claims, instead of restating the "match or pass the
 * accumulated component through" fold.
 */
export function addAddTrackComponent(
  pluginManager: PluginManager,
  {
    adapterTypes,
    component,
  }: {
    adapterTypes: readonly string[]
    component: ComponentType<AddTrackComponentProps>
  },
) {
  pluginManager.addToExtensionPoint(
    /** #extensionPoint Core-addTrackComponent | sync | Inject a custom React component into the add-track widget */
    'Core-addTrackComponent',
    (accumulated, { model }) => {
      const type = model.trackAdapterType
      return type !== undefined && adapterTypes.includes(type)
        ? component
        : accumulated
    },
  )
}
