import type React from 'react'
import { autorun } from 'mobx'
import { onPatch } from 'mobx-state-tree'
import createModel from './createModel'
import type { createSessionModel, createConfigModel } from './createModel'
import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type { SnapshotIn, IJsonPatch } from 'mobx-state-tree'

type SessionSnapshot = SnapshotIn<ReturnType<typeof createSessionModel>>
type ConfigSnapshot = SnapshotIn<ReturnType<typeof createConfigModel>>
type Assembly = ConfigSnapshot['assembly']
type Tracks = ConfigSnapshot['tracks']
type InternetAccounts = ConfigSnapshot['internetAccounts']
type AggregateTextSearchAdapters = ConfigSnapshot['aggregateTextSearchAdapters']

interface ViewStateOptions {
  assembly: Assembly
  tracks: Tracks
  internetAccounts?: InternetAccounts
  aggregateTextSearchAdapters?: AggregateTextSearchAdapters
  configuration?: Record<string, unknown>
  plugins?: PluginConstructor[]
  makeWorkerInstance?: () => Worker
  hydrateFn?: (
    container: Element | Document,
    initialChildren: React.ReactNode,
  ) => any
  createRootFn?: (elt: Element | DocumentFragment) => {
    render: (node: React.ReactElement) => unknown
  }
  defaultSession?: SessionSnapshot
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
}

export default function createViewState(opts: ViewStateOptions) {
  const {
    assembly,
    tracks,
    internetAccounts,
    configuration,
    aggregateTextSearchAdapters,
    plugins,
    hydrateFn,
    createRootFn,
    makeWorkerInstance,
    onChange,
  } = opts
  const { model, pluginManager } = createModel(
    plugins || [],
    makeWorkerInstance,
    hydrateFn,
    createRootFn,
  )
  let { defaultSession } = opts
  if (!defaultSession) {
    defaultSession = {
      name: 'this session',
      view: {
        id: 'circularView',
        type: 'CircularView',
      },
    }
  }
  const stateSnapshot = {
    config: {
      configuration,
      assembly,
      tracks,
      internetAccounts,
      aggregateTextSearchAdapters,
      defaultSession,
    },

    session: defaultSession,
  }
  const stateTree = model.create(stateSnapshot, { pluginManager })
  stateTree.config.internetAccounts.forEach(account => {
    const internetAccountType = pluginManager.getInternetAccountType(
      account.type,
    )
    if (!internetAccountType) {
      throw new Error(`unknown internet account type ${account.type}`)
    }
    stateTree.addInternetAccount({
      type: account.type,
      configuration: account,
    })
  })
  pluginManager.setRootModel(stateTree)
  pluginManager.configure()
  autorun(reaction => {
    const { session, assemblyManager } = stateTree
    if (!session.view.initialized) {
      return
    }
    const regions = assemblyManager.get(assembly?.name)?.regions
    if (!regions) {
      return
    }
    session.view.setDisplayedRegions(regions)
    reaction.dispose()
  })
  if (onChange) {
    onPatch(stateTree, onChange)
  }
  return stateTree
}
