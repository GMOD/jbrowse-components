import type React from 'react'

import { observer } from 'mobx-react'

import type PluginManager from '../PluginManager'

// observer so that observable reads inside evaluateExtensionPoint callbacks
// (e.g. model.trackAdapterType) are tracked here — re-evaluates when they
// change without relying on the parent being an observer
const PluggableComponent = observer(function PluggableComponent<
  P extends Record<string, unknown>,
>({
  pluginManager,
  name,
  component: DefaultComponent,
  props,
}: {
  pluginManager: PluginManager
  name: string
  component: React.ComponentType<P>
  props: P
}) {
  const Component = pluginManager.evaluateExtensionPoint(
    name,
    DefaultComponent,
    props,
  ) as React.ComponentType<P>
  return <Component {...props} />
})

export default PluggableComponent
