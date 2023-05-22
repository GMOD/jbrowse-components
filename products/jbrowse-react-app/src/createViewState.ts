/* eslint-disable @typescript-eslint/no-explicit-any */
import { PluginConstructor } from '@jbrowse/core/Plugin'
import { onPatch, IJsonPatch } from 'mobx-state-tree'
import createModel from './createModel'

interface Location {
  refName: string
  start?: number
  end?: number
  assemblyName?: string
}

export default function createViewState(opts: {
  assemblies: any[]
  tracks: any[]
  internetAccounts?: any[]
  aggregateTextSearchAdapters?: any[]
  configuration?: Record<string, unknown>
  plugins?: PluginConstructor[]
  location?: string | Location
  defaultSession?: any
  disableAddTracks?: boolean
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
  makeWorkerInstance?: () => Worker
}) {
  const {
    assemblies,
    tracks,
    internetAccounts,
    configuration,
    aggregateTextSearchAdapters,
    defaultSession = { name: 'New session' },
    plugins = [],
    onChange,
    makeWorkerInstance,
  } = opts
  const { model, pluginManager } = createModel(plugins, makeWorkerInstance)
  const stateTree = model.create(
    {
      jbrowse: {
        configuration,
        assemblies,
        tracks,
        internetAccounts,
        aggregateTextSearchAdapters,
      },
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
