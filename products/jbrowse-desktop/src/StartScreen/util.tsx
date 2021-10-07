import { useState, useEffect } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import PluginLoader from '@jbrowse/core/PluginLoader'
import { readConfObject } from '@jbrowse/core/configuration'
import deepmerge from 'deepmerge'

import JBrowseRootModelFactory from '../rootModel'
import corePlugins from '../corePlugins'
import { version } from '../../package.json'

import {
  writeAWSAnalytics,
  writeGAAnalytics,
} from '@jbrowse/core/util/analytics'

const defaultInternetAccounts = [
  {
    type: 'DropboxOAuthInternetAccount',
    internetAccountId: 'dropboxOAuth',
    name: 'Dropbox',
    description: 'OAuth Info for Dropbox',
    authEndpoint: 'https://www.dropbox.com/oauth2/authorize',
    tokenEndpoint: 'https://api.dropbox.com/oauth2/token',
    needsAuthorization: true,
    needsPKCE: true,
    hasRefreshToken: true,
    clientId: 'ykjqg1kr23pl1i7',
    domains: [
      'addtodropbox.com',
      'db.tt',
      'dropbox.com',
      'dropboxapi.com',
      'dropboxbusiness.com',
      'dropbox.tech',
      'getdropbox.com',
    ],
  },
  {
    type: 'GoogleDriveOAuthInternetAccount',
    internetAccountId: 'googleOAuth',
    name: 'Google',
    description: 'OAuth Info for Google Drive',
    authEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    needsAuthorization: true,
    clientId:
      '109518325434-m86s8a5og8ijc5m6n7n8dk7e9586bg9i.apps.googleusercontent.com',
    scopes: 'https://www.googleapis.com/auth/drive.readonly',
    responseType: 'token',
    domains: ['drive.google.com'],
  },
]

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
      metadata: { url: definition.url },
    })),
  ])
  pm.createPluggableElements()

  const JBrowseRootModel = JBrowseRootModelFactory(pm)

  const jbrowse = deepmerge(configSnapshot, {
    internetAccounts: defaultInternetAccounts,
  })

  const ids = jbrowse.internetAccounts.map(o => o.internetAccountId)

  jbrowse.internetAccounts = jbrowse.internetAccounts.filter(
    ({ internetAccountId }, index) =>
      !ids.includes(internetAccountId, index + 1),
  )

  const rootModel = JBrowseRootModel.create(
    {
      jbrowse,
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
