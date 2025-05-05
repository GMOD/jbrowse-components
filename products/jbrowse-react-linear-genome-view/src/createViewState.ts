import { assembleLocString, parseLocString } from '@jbrowse/core/util'
import { onPatch } from 'mobx-state-tree'

import createModel from './createModel'
import { createPluginManager } from './createModel/createPluginManager'

import type { createConfigModel, createSessionModel } from './createModel'
import type { ViewStateModel } from './createModel/createModel'
import type { PluginConstructor } from '@jbrowse/core/Plugin'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { IJsonPatch, SnapshotIn } from 'mobx-state-tree'

type SessionSnapshot = SnapshotIn<ReturnType<typeof createSessionModel>>
type ConfigSnapshot = SnapshotIn<ReturnType<typeof createConfigModel>>
type Assembly = ConfigSnapshot['assembly']
type Tracks = ConfigSnapshot['tracks']
type InternetAccounts = ConfigSnapshot['internetAccounts']
type AggregateTextSearchAdapters = ConfigSnapshot['aggregateTextSearchAdapters']

interface Location {
  refName: string
  start?: number
  end?: number
  assemblyName?: string
}

export default function createViewState({
  plugins = [],
  makeWorkerInstance,
  ...rest
}: {
  assembly: Assembly
  tracks: Tracks
  internetAccounts?: InternetAccounts
  aggregateTextSearchAdapters?: AggregateTextSearchAdapters
  configuration?: Record<string, unknown>
  plugins?: PluginConstructor[]
  location?: string | Location
  highlight?: string[]
  defaultSession?: SessionSnapshot
  disableAddTracks?: boolean
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
  makeWorkerInstance?: () => Worker
}) {
  const pluginManager = createPluginManager({ runtimePlugins: plugins })
  const model = createModel({
    pluginManager,
    makeWorkerInstance,
  })
  return createViewStateFromModel({
    model,
    pluginManager,
    ...rest,
  })
}

export function createViewStateFromModel({
  model,
  pluginManager,
  assembly,
  tracks,
  internetAccounts,
  configuration,
  aggregateTextSearchAdapters,
  location,
  highlight,
  onChange,
  disableAddTracks = false,
  defaultSession,
}: {
  pluginManager: PluginManager
  model: ViewStateModel
  assembly: Assembly
  tracks: Tracks
  internetAccounts?: InternetAccounts
  aggregateTextSearchAdapters?: AggregateTextSearchAdapters
  configuration?: Record<string, unknown>
  location?: string | Location
  highlight?: string[]
  defaultSession?: SessionSnapshot
  disableAddTracks?: boolean
  onChange?: (patch: IJsonPatch, reversePatch: IJsonPatch) => void
}) {
  const stateTree = model.create(
    {
      config: {
        configuration,
        assembly,
        tracks,
        internetAccounts,
        aggregateTextSearchAdapters,
      },
      disableAddTracks,
      session: defaultSession ?? {
        name: 'this session',
        view: {
          id: 'linearGenomeView',
          type: 'LinearGenomeView',
        },
      },
    },
    { pluginManager },
  )
  for (const account of stateTree.config.internetAccounts) {
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
  }
  pluginManager.setRootModel(stateTree)
  pluginManager.configure()
  if (location) {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    ;(async () => {
      const { session } = stateTree
      const { isValidRefName } = session.assemblyManager

      try {
        await session.view.navToLocString(
          typeof location === 'string' ? location : assembleLocString(location),
          assembly.name,
        )
        if (highlight) {
          for (const h of highlight) {
            if (h) {
              const p = parseLocString(h, refName =>
                isValidRefName(refName, assembly.name),
              )
              const { start, end } = p
              if (start !== undefined && end !== undefined) {
                session.view.addToHighlights({
                  ...p,
                  start,
                  end,
                  assemblyName: assembly,
                })
              }
            }
          }
        }
      } catch (e) {
        session.notifyError(`${e}`, e)
      }
    })()
  }
  if (onChange) {
    onPatch(stateTree, onChange)
  }
  return stateTree
}
