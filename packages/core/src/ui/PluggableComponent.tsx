import { observer } from 'mobx-react'

import type PluginManager from '../PluginManager'
import type React from 'react'

// observer so that observable reads inside evaluateExtensionPoint callbacks
// (e.g. model.trackAdapterType) are tracked here — re-evaluates when they
// change without relying on the parent being an observer
const PluggableComponent = observer(function PluggableComponent<
  P extends object,
>({
  pluginManager,
  name,
  component: DefaultComponent,
  props,
}: {
  pluginManager: PluginManager
  name: string
  component:
    | React.ComponentType<P>
    | React.LazyExoticComponent<React.ComponentType<P>>
  props: P
}) {
  // props is forwarded verbatim as the extension-point context bag; any object
  // is a valid bag, so widen to the untyped-overload param type here rather
  // than constraining callers' component props to carry an index signature
  const Component = pluginManager.evaluateExtensionPoint(
    name,
    DefaultComponent,
    props as Record<string, unknown>,
  ) as React.ComponentType<P>
  return <Component {...props} />
})

export default PluggableComponent
