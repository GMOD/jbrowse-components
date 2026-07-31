import type PluginManager from '../PluginManager.ts'
import type {
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
 * Prefer this to calling `addToExtensionPoint` directly. The hand-written form
 * is `(rest, props) => [...rest, <C key="..." {...props} />]` at every call
 * site, where dropping the spread silently removes every other plugin's overlay
 * and forgetting the `key` produces a React warning that points at framework
 * code rather than at the plugin.
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
  // the constraint says this point's args are ReactNode[] and its props are the
  // component's props, but TS cannot see either through the generic key, so
  // both are restated (the same limitation PluggableComponent works around)
  pluginManager.addToExtensionPoint<ReactNode[]>(name, (elements, props) => [
    ...elements,
    <Component key={key} {...(props as ExtensionPointProps<N>)} />,
  ])
}
