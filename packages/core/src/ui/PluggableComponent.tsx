import { observer } from 'mobx-react'

import type PluginManager from '../PluginManager'
import type {
  ExtensionPointArgs,
  ExtensionPointName,
  ExtensionPointProps,
} from '../PluginManager'
import type React from 'react'

// A point rendered here is a single-component fold: its registry entry declares
// `args`/`result` as the component type and `props` as that component's prop
// bag (see Core-replaceWidget for the canonical shape). Taking the name as a
// registry key rather than a bare string is what checks the default component
// and the props against the contract, instead of trusting the call site.
//
// observer so that observable reads inside evaluateExtensionPoint callbacks
// (e.g. model.trackAdapterType) are tracked here — re-evaluates when they
// change without relying on the parent being an observer
const PluggableComponent = observer(function PluggableComponent<
  N extends ExtensionPointName,
  P extends object,
>({
  pluginManager,
  name,
  component: DefaultComponent,
  props,
}: {
  pluginManager: PluginManager
  name: N
  component:
    React.ComponentType<P> | React.LazyExoticComponent<React.ComponentType<P>>
  props: P & ExtensionPointProps<N>
}) {
  // the result is the point's declared component type; TS can't narrow that
  // through the generic key, so it is restated here
  const Component = pluginManager.evaluateExtensionPoint(
    name,
    DefaultComponent as ExtensionPointArgs<N>,
    props,
  ) as React.ComponentType<P>
  return <Component {...props} />
})

export default PluggableComponent
