import type PluginManager from '../PluginManager.ts'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { ComponentType } from 'react'

/**
 * The slice of the add-track widget model an adapter-specific picker gets. It
 * is deliberately narrower than the widget's own model: a picker reads which
 * adapter is selected and contributes config fragments through `mixinData`,
 * which the widget merges into the track config on submit.
 */
export interface AddTrackComponentModel extends IStateTreeNode {
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
    // The same claims as the point above, as a plain list. The fold there can
    // only answer "which component for this model", which needs a model — and a
    // caller asking whether a format is configurable at all has an adapter name
    // and nothing else. Both are written by addAddTrackComponent, so a plugin
    // still states its adapters once.
    'Core-addTrackComponentAdapterTypes': {
      args: readonly string[]
      result: readonly string[]
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
  pluginManager.contributeToExtensionPoint(
    /** #extensionPoint Core-addTrackComponentAdapterTypes | sync | Adapter types whose add-track form contributes required config */
    'Core-addTrackComponentAdapterTypes',
    () => [...adapterTypes],
  )
}

/**
 * Whether a picker claims this adapter, i.e. the file alone does not describe
 * the track. A synteny picker contributes the assembly pair — on the adapter
 * *and* as the track's `assemblyNames`, because a synteny view only offers
 * tracks covering every assembly it displays — so a config built without one
 * lands in the session and then never appears in the view it was made for.
 *
 * For workflows that guess a config straight from a filename and so cannot run
 * the picker: ask before offering to add the track, and send the user to the
 * single-track form instead. The list is written by `addAddTrackComponent`, so
 * it covers every plugin that registers one rather than a hardcoded set that
 * goes stale when the next plugin lands.
 */
export function adapterNeedsAddTrackComponent(
  pluginManager: PluginManager,
  adapterType: string,
) {
  return pluginManager
    .evaluateExtensionPoint('Core-addTrackComponentAdapterTypes', [])
    .includes(adapterType)
}
