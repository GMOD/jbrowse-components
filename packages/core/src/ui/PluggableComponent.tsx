import type PluginManager from '../PluginManager'
import type React from 'react'

export default function PluggableComponent<
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
}
