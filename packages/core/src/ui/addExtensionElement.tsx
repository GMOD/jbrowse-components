import type PluginManager from '../PluginManager.ts'
import type {
  ExtensionPointEntry,
  ExtensionPointName,
  ExtensionPointProps,
  ExtensionPointRegistry,
} from '../PluginManager.ts'
import type { ComponentType, ReactNode } from 'react'

/**
 * The extension points that accumulate an array of rendered elements (the LGV
 * and dotplot overlay points). Points accumulating an array of *components*
 * (`Core-extraFeaturePanel` and friends) are excluded: a component is not a
 * `ReactNode`, so they do not match.
 */
export type ElementExtensionPointName = {
  [
    N in ExtensionPointName
  ]: ExtensionPointRegistry[N]['args'] extends ReactNode[] ? N : never
}[ExtensionPointName]

/**
 * Render `component` into an overlay extension point, passing it the point's
 * props.
 *
 * Prefer this to contributing the element yourself: it fixes the React `key` at
 * registration time, and forgetting that one produces a warning pointing at
 * framework code rather than at the plugin.
 */
export function addExtensionElement<N extends ElementExtensionPointName>(
  pluginManager: PluginManager,
  name: N,
  component: ComponentType<ExtensionPointProps<N>>,
) {
  const Component = component
  // unique per registration, and stable across renders because it is fixed at
  // registration time rather than derived from anything the fold sees
  const key = `${name}-${Component.displayName ?? Component.name}-${
    pluginManager.extensionPoints.get(name)?.length ?? 0
  }`
  // ElementExtensionPointName constrains this point's entry to a ReactNode, but
  // neither compiler resolves ExtensionPointEntry<N> through the generic key.
  // tsc7 rejects the element without the assertion; eslint's TS6 service thinks
  // the assertion is redundant. Same split as SessionTracks.ts.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion -- tsc7 needs it
  /* oxlint-disable typescript/no-unnecessary-type-assertion */
  pluginManager.contributeToExtensionPoint(
    name,
    props => (<Component key={key} {...props} />) as ExtensionPointEntry<N>,
  )
  /* oxlint-enable typescript/no-unnecessary-type-assertion */
}
