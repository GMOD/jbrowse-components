import type React from 'react'
import { onPatch } from 'mobx-state-tree'
import createModel from './createModel'
import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { BaseAssemblyConfigSchema } from '@jbrowse/core/assemblyManager'
import type { IJsonPatch, SnapshotIn } from 'mobx-state-tree'

// locals

interface TextSearchAdapterConfig {
  textSearchAdapterId: string
  [key: string]: unknown
}
interface InternetAccountConfig {
  internetAccountId: string
  [key: string]: unknown
}
interface TrackConfig {
  trackId: string
  [key: string]: unknown
}
interface SessionSnapshot {
  name: string
  [key: string]: unknown
}
interface Config {
  assemblies: SnapshotIn<BaseAssemblyConfigSchema>[]
  tracks: TrackConfig[]
  internetAccounts?: InternetAccountConfig[]
  aggregateTextSearchAdapters?: TextSearchAdapterConfig[]
  configuration?: Record<string, unknown>
  defaultSession?: SessionSnapshot
}

export default function createViewState(opts: {
  config: Config
  plugins?: PluginConstructor[]
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
  makeWorkerInstance?: () => Worker
  hydrateFn?: (
    container: Element | Document,
    initialChildren: React.ReactNode,
  ) => any
  createRootFn?: (elt: Element | DocumentFragment) => {
    render: (node: React.ReactElement) => unknown
  }
}) {
  const {
    config,
    plugins = [],
    onChange,
    makeWorkerInstance,
    hydrateFn,
    createRootFn,
  } = opts
  const { defaultSession = { name: 'NewSession' } } = config
  const { model, pluginManager } = createModel(
    plugins,
    makeWorkerInstance,
    hydrateFn,
    createRootFn,
  )
  const stateTree = model.create(
    {
      jbrowse: config,
      session: defaultSession,
    },
    { pluginManager },
  )

  pluginManager.setRootModel(stateTree)
  pluginManager.configure()

  if (onChange) {
    onPatch(stateTree, onChange)
  }
  return stateTree
}
