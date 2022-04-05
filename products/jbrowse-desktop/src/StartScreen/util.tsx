import { useState, useEffect } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import PluginLoader from '@jbrowse/core/PluginLoader'
import { readConfObject } from '@jbrowse/core/configuration'
import deepmerge from 'deepmerge'
import { ipcRenderer } from 'electron'

import JBrowseRootModelFactory from '../rootModel'
import corePlugins from '../corePlugins'
import { version } from '../../package.json'

import {
  writeAWSAnalytics,
  writeGAAnalytics,
} from '@jbrowse/core/util/analytics'

function uniqBy<T>(a: T[], key: (arg: T) => string) {
  const seen = new Set()
  return a.filter(item => {
    const k = key(item)
    return seen.has(k) ? false : seen.add(k)
  })
}

const defaultInternetAccounts = [
  {
    type: 'DropboxOAuthInternetAccount',
    internetAccountId: 'dropboxOAuth',
    name: 'Dropbox',
    description: 'Account to access Dropbox files',
    clientId: 'ykjqg1kr23pl1i7',
  },
  {
    type: 'GoogleDriveOAuthInternetAccount',
    internetAccountId: 'googleOAuth',
    name: 'Google Drive',
    description: 'Account to access Google Drive files',
    clientId:
      '109518325434-m86s8a5og8ijc5m6n7n8dk7e9586bg9i.apps.googleusercontent.com',
  },
]

export async function loadPluginManager(filePath: string) {
  const snap = await ipcRenderer.invoke('loadSession', filePath)
  const pm = await createPluginManager(snap)
  // @ts-ignore
  pm.rootModel?.setSessionPath(filePath)
  return pm
}

export async function createPluginManager(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configSnapshot: any,
  initialTimestamp = +Date.now(),
) {
  const pluginLoader = new PluginLoader(configSnapshot.plugins)
  pluginLoader.installGlobalReExports(window)
  const runtimePlugins = await pluginLoader.load()
  const pm = new PluginManager([
    ...corePlugins.map(P => ({
      plugin: new P(),
      metadata: { isCore: true },
    })),
    ...runtimePlugins.map(({ plugin: P, definition }) => ({
      plugin: new P(),
      definition,
      metadata: {
        url: definition.url,
        esmUrl: definition.esmUrl,
        umdUrl: definition.umdUrl,
        cjsUrl: definition.cjsUrl,
      },
    })),
  ])
  pm.createPluggableElements()

  const JBrowseRootModel = JBrowseRootModelFactory(pm)

  const jbrowse = deepmerge(configSnapshot, {
    internetAccounts: defaultInternetAccounts,
    assemblies: [],
    tracks: [],
  }) as {
    internetAccounts: { internetAccountId: string }[]
    assemblies: { name: string }[]
    tracks: { trackId: string }[]
  }

  jbrowse.assemblies = uniqBy(jbrowse.assemblies, asm => asm.name)
  jbrowse.tracks = uniqBy(jbrowse.tracks, acct => acct.trackId)
  jbrowse.internetAccounts = uniqBy(
    jbrowse.internetAccounts,
    acct => acct.internetAccountId,
  )

  const rootModel = JBrowseRootModel.create(
    {
      jbrowse,
      JobsManager: {},
      assemblyManager: {},
      version,
    },
    { pluginManager: pm },
  )

  const config = rootModel.jbrowse.configuration
  const { rpc } = config

  rpc.addDriverConfig('WebWorkerRpcDriver', {
    type: 'WebWorkerRpcDriver',
  })
  rpc.defaultDriver.set('WebWorkerRpcDriver')

  pm.setRootModel(rootModel)
  pm.configure()

  if (rootModel && !readConfObject(config, 'disableAnalytics')) {
    writeAWSAnalytics(rootModel, initialTimestamp)
    writeGAAnalytics(rootModel, initialTimestamp)
  }

  rootModel.setDefaultSession()

  return pm
}

// similar to https://blog.logrocket.com/using-localstorage-react-hooks/
export const useLocalStorage = (key: string, defaultValue: string) => {
  const [value, setValue] = useState(
    () => localStorage.getItem(key) || defaultValue,
  )

  useEffect(() => {
    localStorage.setItem(key, value)
  }, [key, value])

  // without this cast, tsc complained that the type of setValue could be a
  // string or a callback
  return [value, setValue] as [string, (arg: string) => void]
}
