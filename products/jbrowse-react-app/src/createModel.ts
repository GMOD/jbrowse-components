import type React from 'react'
import PluginManager from '@jbrowse/core/PluginManager'

// locals
import corePlugins from './corePlugins'
import createRootModel from './rootModel'
import sessionModelFactory from './sessionModel'
import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { Instance } from 'mobx-state-tree'

export default function createModel(
  runtimePlugins: PluginConstructor[],
  makeWorkerInstance: () => Worker = () => {
    throw new Error('no makeWorkerInstance supplied')
  },
  hydrateFn?: (
    container: Element | Document,
    initialChildren: React.ReactNode,
  ) => any,
  createRootFn?: (elt: Element | DocumentFragment) => {
    render: (node: React.ReactElement) => unknown
  },
) {
  const pluginManager = new PluginManager([
    ...corePlugins.map(P => ({ plugin: new P(), metadata: { isCore: true } })),
    ...runtimePlugins.map(P => new P()),
  ]).createPluggableElements()

  return {
    model: createRootModel({
      pluginManager,
      sessionModelFactory,
      makeWorkerInstance,
      hydrateFn,
      createRootFn,
    }),
    pluginManager,
  }
}

export type ViewStateModel = ReturnType<typeof createModel>['model']
export type ViewModel = Instance<ViewStateModel>
