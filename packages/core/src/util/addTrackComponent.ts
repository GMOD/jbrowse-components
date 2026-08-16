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
    // The `ownsAssembly` claims from the point above, as a plain list. The fold
    // there can only answer "which component for this model", which needs a
    // model — and a caller asking whether a format is configurable at all has an
    // adapter name and nothing else. Both are written by addAddTrackComponent,
    // so a plugin still states its adapters once.
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
 *
 * `ownsAssembly` is the one thing a picker cannot be left to decide by
 * omission. The widget's own assembly dropdown is *not* rendered for a picker
 * that claims it, because a synteny picker asks for the assembly **pair** and
 * two dropdowns disagreeing about which one wins is worse than one. Every other
 * picker keeps the dropdown above it and contributes only its own fields — the
 * default, because a picker that simply forgot to render an assembly selector
 * used to silently remove the only way to choose one.
 */
export function addAddTrackComponent(
  pluginManager: PluginManager,
  {
    adapterTypes,
    component,
    ownsAssembly = false,
  }: {
    adapterTypes: readonly string[]
    component: ComponentType<AddTrackComponentProps>
    /**
     * The picker asks for the assembly itself, so the widget yields its own
     * assembly dropdown to it — and a workflow that can only guess from a
     * filename cannot build this format at all.
     */
    ownsAssembly?: boolean
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
  if (ownsAssembly) {
    pluginManager.contributeToExtensionPoint(
      /** #extensionPoint Core-addTrackComponentAdapterTypes | sync | Adapter types whose add-track picker supplies the assembly */
      'Core-addTrackComponentAdapterTypes',
      () => [...adapterTypes],
    )
  }
}

/**
 * Whether a picker supplies this adapter's assembly, i.e. the file alone does
 * not describe the track. A synteny picker contributes the assembly pair — on
 * the adapter *and* as the track's `assemblyNames`, because a synteny view only
 * offers tracks covering every assembly it displays — so a config built without
 * one lands in the session and then never appears in the view it was made for.
 *
 * Two callers, both reading the same fact:
 *
 * - The widget hides its own assembly dropdown, leaving the picker to ask.
 * - Workflows that guess a config straight from a filename and so cannot run
 *   the picker (bulk add) decline the file and send the user to the
 *   single-track form.
 *
 * A picker contributing only optional fields answers false, and its file adds
 * like any other. The list is written by `addAddTrackComponent`, so it covers
 * every plugin that registers one rather than a hardcoded set that goes stale
 * when the next plugin lands.
 */
export function adapterNeedsAddTrackComponent(
  pluginManager: PluginManager,
  adapterType: string,
) {
  return pluginManager
    .evaluateExtensionPoint('Core-addTrackComponentAdapterTypes', [])
    .includes(adapterType)
}
