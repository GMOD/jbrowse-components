import React from 'react'
import { PluginConstructor } from '@jbrowse/core/Plugin'
import {
  ParsedLocString,
  assembleLocString,
  parseLocString,
} from '@jbrowse/core/util'
import { SnapshotIn, onPatch, IJsonPatch } from 'mobx-state-tree'
import createModel, {
  createSessionModel,
  createConfigModel,
} from './createModel'

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

interface ViewStateOptions {
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
  hydrateFn?: (
    container: Element | Document,
    initialChildren: React.ReactNode,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ) => any
  createRootFn?: (elt: Element | DocumentFragment) => {
    render: (node: React.ReactElement) => unknown
  }
}

export default function createViewState(opts: ViewStateOptions) {
  const {
    assembly,
    tracks,
    internetAccounts,
    configuration,
    aggregateTextSearchAdapters,
    plugins,
    location,
    highlight,
    onChange,
    disableAddTracks = false,
    makeWorkerInstance,
    hydrateFn,
    createRootFn,
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
        id: 'linearGenomeView',
        type: 'LinearGenomeView',
      },
    }
  }
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
      session: defaultSession,
    },
    { pluginManager },
  )
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
          highlight.forEach(async h => {
            if (h) {
              const parsedLocString = parseLocString(h, refName =>
                isValidRefName(refName, assembly),
              ) as Required<ParsedLocString>

              const location = {
                ...parsedLocString,
                assemblyName: assembly,
              }

              if (
                location?.start !== undefined &&
                location?.end !== undefined
              ) {
                session.view.setHighlight(location)
              }
            }
          })
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
