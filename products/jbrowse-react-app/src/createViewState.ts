/* eslint-disable @typescript-eslint/no-explicit-any */
import { PluginConstructor } from '@jbrowse/core/Plugin'
// import { autorun } from 'mobx'
import { onPatch, IJsonPatch } from 'mobx-state-tree'
import createModel from './createModel'

interface Location {
  refName: string
  start?: number
  end?: number
  assemblyName?: string
}

interface ViewStateOptions {
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
}

export default function createViewState(opts: ViewStateOptions) {
  const {
    assemblies,
    tracks,
    internetAccounts,
    configuration,
    aggregateTextSearchAdapters,
    plugins,
    onChange,
    makeWorkerInstance,
  } = opts
  const { model, pluginManager } = createModel(
    plugins || [],
    makeWorkerInstance,
  )
  let { defaultSession } = opts
  if (!defaultSession) {
    defaultSession = {
      name: 'this session',
    }
  }
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
  // stateTree.jbrowse.internetAccounts.forEach(account => {
  //   const internetAccountType = pluginManager.getInternetAccountType(
  //     account.type,
  //   )
  //   if (!internetAccountType) {
  //     throw new Error(`unknown internet account type ${account.type}`)
  //   }
  //   stateTree.addInternetAccount({
  //     type: account.type,
  //     configuration: account,
  //   })
  // })
  pluginManager.setRootModel(stateTree)
  pluginManager.configure()
  // if (location) {
  //   autorun(async reaction => {
  //     const { session } = stateTree
  //     try {
  //       if (!session.view.initialized) {
  //         return
  //       }

  //       if (typeof location === 'string') {
  //         await session.view.navToLocString(location, assembly.name)
  //       } else {
  //         session.view.navTo(location)
  //       }
  //     } catch (e) {
  //       session.notify(`${e}`, 'error')
  //     }
  //     reaction.dispose()
  //   })
  // }
  if (onChange) {
    onPatch(stateTree, onChange)
  }
  return stateTree
}
