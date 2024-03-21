import React from 'react'
import { PluginConstructor } from '@jbrowse/core/Plugin'
import PluginManager from '@jbrowse/core/PluginManager'
import { Instance } from 'mobx-state-tree'

// locals
import corePlugins from './corePlugins'
import createRootModel from './rootModel'
import sessionModelFactory from './sessionModel'

export default function createModel(
  runtimePlugins: PluginConstructor[],
  makeWorkerInstance: () => Worker = () => {
    throw new Error('no makeWorkerInstance supplied')
  },
  hydrateFn?: (
    container: Element | Document,
    initialChildren: React.ReactNode,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any,
  createRootFn?: (elt: Element | DocumentFragment) => {
    render: (node: React.ReactElement) => unknown
  },
) {
  const pluginManager = new PluginManager([
    ...corePlugins.map(P => ({ metadata: { isCore: true }, plugin: new P() })),
    ...runtimePlugins.map(P => new P()),
  ]).createPluggableElements()

  return {
    model: createRootModel({
      createRootFn,
      hydrateFn,
      makeWorkerInstance,
      pluginManager,
      sessionModelFactory,
    }),
    pluginManager,
  }
}

export type ViewStateModel = ReturnType<typeof createModel>['model']
export type ViewModel = Instance<ViewStateModel>
