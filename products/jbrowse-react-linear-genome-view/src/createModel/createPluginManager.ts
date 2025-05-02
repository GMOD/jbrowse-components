import PluginManager from '@jbrowse/core/PluginManager'

import corePlugins from '../corePlugins'

import type { PluginConstructor } from '@jbrowse/core/Plugin'

export function createPluginManager({
  runtimePlugins = [],
}: {
  runtimePlugins?: PluginConstructor[]
}) {
  return new PluginManager(
    [...corePlugins, ...runtimePlugins].map(P => new P()),
  ).createPluggableElements()
}
