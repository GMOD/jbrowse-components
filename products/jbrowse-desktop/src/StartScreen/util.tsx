import PluginManager from '@jbrowse/core/PluginManager'
import PluginLoader, { LoadedPlugin } from '@jbrowse/core/PluginLoader'
import { readConfObject } from '@jbrowse/core/configuration'
import deepmerge from 'deepmerge'
import sanitize from 'sanitize-filename'

import {
  writeAWSAnalytics,
  writeGAAnalytics,
} from '@jbrowse/core/util/analytics'

// locals
import JBrowseRootModelFactory from '../rootModel'
import corePlugins from '../corePlugins'
import packageJSON from '../../package.json'

const { ipcRenderer } = window.require('electron')

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

export async function loadPluginManager(configPath: string) {
  const snap = await ipcRenderer.invoke('loadSession', configPath)
  const pm = await createPluginManager(snap)
  // @ts-expect-error
  pm.rootModel?.setSessionPath(configPath)
  return pm
}

export async function createPluginManager(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configSnapshot: any,
  initialTimestamp = +Date.now(),
) {
  const pluginLoader = new PluginLoader(configSnapshot.plugins, {
    fetchESM: url => import(/* webpackIgnore:true */ url),
    fetchCJS: async url => {
      const fs: typeof import('fs') = window.require('fs')
      const path: typeof import('path') = window.require('path')
      const os: typeof import('os') = window.require('os')
      const http: typeof import('http') = window.require('http')
      const fsPromises = fs.promises
      // On macOS `os.tmpdir()` returns the path to a symlink, see:
      // https://github.com/nodejs/node/issues/11422
      const tmpDir = await fsPromises.mkdtemp(
        path.join(await fsPromises.realpath(os.tmpdir()), 'jbrowse-plugin-'),
      )
      let plugin: LoadedPlugin | undefined = undefined
      try {
        const pluginLocation = path.join(tmpDir, sanitize(url))
        const pluginLocationRelative = path.relative('.', pluginLocation)

        await new Promise((resolve, reject) => {
          const file = fs.createWriteStream(pluginLocation)
          http
            .get(url, res => {
              res.pipe(file)
              file.on('finish', resolve)
            })
            .on('error', err => {
              fs.unlinkSync(pluginLocation)
              reject(err)
            })
        })
        plugin = window.require(pluginLocationRelative) as
          | LoadedPlugin
          | undefined
      } finally {
        await fsPromises.rmdir(tmpDir, { recursive: true })
      }

      if (!plugin) {
        throw new Error(`Could not load CJS plugin: ${url}`)
      }
      return plugin
    },
  })
  pluginLoader.installGlobalReExports(window)
  const runtimePlugins = await pluginLoader.load(window.location.href)
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
      jobsManager: {},
      assemblyManager: {},
      version: packageJSON.version,
    },
    { pluginManager: pm },
  )

  const config = rootModel.jbrowse.configuration
  const { rpc } = config
  rpc.defaultDriver.set('WebWorkerRpcDriver')

  pm.setRootModel(rootModel)
  pm.configure()

  if (rootModel && !readConfObject(config, 'disableAnalytics')) {
    // these are ok if they are uncaught promises
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    writeAWSAnalytics(rootModel, initialTimestamp)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    writeGAAnalytics(rootModel, initialTimestamp)
  }

  rootModel.setDefaultSession()

  return pm
}

export interface RecentSessionData {
  path: string
  name: string
  screenshot?: string
  updated: number
}
