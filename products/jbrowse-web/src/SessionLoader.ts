import PluginLoader from '@jbrowse/core/PluginLoader'
import { openLocation } from '@jbrowse/core/util/io'
import { nanoid } from '@jbrowse/core/util/nanoid'
import { autorun } from 'mobx'
import { addDisposer, types } from 'mobx-state-tree'

import { readSessionFromDynamo } from './sessionSharing'
import { addRelativeUris, checkPlugins, fromUrlSafeB64, readConf } from './util'

import type { SessionTriagedInfo } from './types'
import type { PluginDefinition, PluginRecord } from '@jbrowse/core/PluginLoader'
import type { Instance } from 'mobx-state-tree'

const SessionLoader = types
  .model({
    /**
     * #property
     */
    configPath: types.maybe(types.string),
    /**
     * #property
     */
    sessionQuery: types.maybe(types.string),
    /**
     * #property
     */
    password: types.maybe(types.string),
    /**
     * #property
     */
    adminKey: types.maybe(types.string),
    /**
     * #property
     */
    loc: types.maybe(types.string),
    /**
     * #property
     */
    sessionTracks: types.maybe(types.string),
    /**
     * #property
     */
    assembly: types.maybe(types.string),
    /**
     * #property
     */
    tracks: types.maybe(types.string),
    /**
     * #property
     */
    tracklist: types.maybe(types.boolean),
    /**
     * #property
     */
    highlight: types.maybe(types.string),
    /**
     * #property
     */
    nav: types.maybe(types.boolean),
    /**
     * #property
     */
    initialTimestamp: types.number,

    /**
     * #property
     */
    hubURL: types.maybe(types.array(types.string)),
  })
  .volatile(() => ({
    /**
     * #volatile
     */
    sessionTriaged: undefined as SessionTriagedInfo | undefined,
    /**
     * #volatile
     */
    configSnapshot: undefined as Record<string, unknown> | undefined,
    /**
     * #volatile
     */
    sessionSnapshot: undefined as Record<string, unknown> | undefined,
    /**
     * #volatile
     */
    sessionSpec: undefined as Record<string, unknown> | undefined,
    /**
     * #volatile
     */
    hubSpec: undefined as Record<string, unknown> | undefined,
    /**
     * #volatile
     */
    blankSession: false,
    /**
     * #volatile
     */
    runtimePlugins: [] as PluginRecord[],
    /**
     * #volatile
     */
    sessionPlugins: [] as PluginRecord[],
    /**
     * #volatile
     */
    sessionError: undefined as unknown,
    /**
     * #volatile
     */
    configError: undefined as unknown,
    /**
     * #volatile
     */
    bc1:
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      window.BroadcastChannel
        ? new window.BroadcastChannel('jb_request_session')
        : undefined,
    /**
     * #volatile
     */
    bc2:
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      window.BroadcastChannel
        ? new window.BroadcastChannel('jb_respond_session')
        : undefined,
  }))
  .views(self => ({
    /**
     * #getter
     */
    get isSharedSession() {
      return !!self.sessionQuery?.startsWith('share-')
    },
    /**
     * #getter
     */
    get isSpecSession() {
      return !!self.sessionQuery?.startsWith('spec-')
    },
    /**
     * #getter
     */
    get isHubSession() {
      return !!self.hubURL
    },
    /**
     * #getter
     */
    get isJb1StyleSession() {
      return !!self.loc
    },

    /**
     * #getter
     */
    get isEncodedSession() {
      return !!self.sessionQuery?.startsWith('encoded-')
    },
    /**
     * #getter
     */
    get isJsonSession() {
      return !!self.sessionQuery?.startsWith('json-')
    },
    /**
     * #getter
     */
    get isLocalSession() {
      return !!self.sessionQuery?.startsWith('local-')
    },
    /**
     * #getter
     */
    get ready() {
      return Boolean(this.isSessionLoaded && !self.configError)
    },
    /**
     * #getter
     */
    get error() {
      return self.configError || self.sessionError
    },
    /**
     * #getter
     */
    get isSessionLoaded() {
      return Boolean(
        self.sessionError ||
          self.sessionSnapshot ||
          self.blankSession ||
          self.sessionSpec,
      )
    },
    /**
     * #getter
     */
    get isConfigLoaded() {
      return Boolean(self.configError || self.configSnapshot)
    },
    /**
     * #getter
     */
    get sessionTracksParsed() {
      return self.sessionTracks ? JSON.parse(self.sessionTracks) : []
    },
  }))
  .actions(self => ({
    /**
     * #action
     */
    setSessionQuery(session?: any) {
      self.sessionQuery = session
    },
    /**
     * #action
     */
    setConfigError(error: unknown) {
      self.configError = error
    },
    /**
     * #action
     */
    setSessionError(error: unknown) {
      self.sessionError = error
    },
    /**
     * #action
     */
    setRuntimePlugins(plugins: PluginRecord[]) {
      self.runtimePlugins = plugins
    },
    /**
     * #action
     */
    setSessionPlugins(plugins: PluginRecord[]) {
      self.sessionPlugins = plugins
    },
    /**
     * #action
     */
    setConfigSnapshot(snap: Record<string, unknown>) {
      self.configSnapshot = snap
    },
    /**
     * #action
     */
    setBlankSession(flag: boolean) {
      self.blankSession = flag
    },
    /**
     * #action
     */
    setSessionTriaged(args?: SessionTriagedInfo) {
      self.sessionTriaged = args
    },
    /**
     * #action
     */
    setSessionSnapshotSuccess(snap: Record<string, unknown>) {
      self.sessionSnapshot = snap
    },
  }))
  .actions(self => ({
    /**
     * #action
     */
    async fetchPlugins(config: { plugins: PluginDefinition[] }) {
      try {
        const pluginLoader = new PluginLoader(config.plugins, {
          fetchESM: url => import(/* webpackIgnore:true */ url),
        })
        pluginLoader.installGlobalReExports(window)
        const runtimePlugins = await pluginLoader.load(window.location.href)
        self.setRuntimePlugins([...runtimePlugins])
      } catch (e) {
        console.error(e)
        self.setConfigError(e)
      }
    },
    /**
     * #action
     */
    async fetchSessionPlugins(snap: { sessionPlugins?: PluginDefinition[] }) {
      try {
        const pluginLoader = new PluginLoader(snap.sessionPlugins || [], {
          fetchESM: url => import(/* webpackIgnore:true */ url),
        }).installGlobalReExports(window)
        const plugins = await pluginLoader.load(window.location.href)
        self.setSessionPlugins([...plugins])
      } catch (e) {
        console.error(e)
        self.setConfigError(e)
      }
    },

    /**
     * #action
     */
    async setSessionSnapshot(
      snap: { sessionPlugins?: PluginDefinition[]; id: string },
      userAcceptedConfirmation?: boolean,
    ) {
      try {
        const { sessionPlugins = [] } = snap
        const sessionPluginsAllowed = await checkPlugins(sessionPlugins)
        if (sessionPluginsAllowed || userAcceptedConfirmation) {
          await this.fetchSessionPlugins(snap)
          self.setSessionSnapshotSuccess(snap)
        } else {
          self.setSessionTriaged({
            snap,
            origin: 'session',
            reason: sessionPlugins,
          })
        }
      } catch (e) {
        console.error(e)
        self.setConfigError(e)
      }
    },
    /**
     * #action
     */
    async fetchConfig() {
      // @ts-expect-error
      const path = window.__jbrowseConfigPath
      let { hubURL, configPath = path || 'config.json' } = self
      console.log({ hubURL, configPath })
      if (!hubURL) {
        // @ts-expect-error
        if (window.__jbrowseCacheBuster) {
          configPath += `?rand=${Math.random()}`
        }
        const text = await openLocation({
          uri: configPath,
          locationType: 'UriLocation',
        }).readFile('utf8')
        const config = JSON.parse(text)
        const configUri = new URL(configPath, window.location.href)
        addRelativeUris(config, configUri)

        // cross origin config check
        if (configUri.hostname !== window.location.hostname) {
          const configPlugins = config.plugins || []
          const configPluginsAllowed = await checkPlugins(configPlugins)
          if (!configPluginsAllowed) {
            self.setSessionTriaged({
              snap: config,
              origin: 'config',
              reason: configPlugins,
            })
            return
          }
        }
        await this.fetchPlugins(config)
        self.setConfigSnapshot(config)
      } else {
        self.setConfigSnapshot({})
      }
    },
    /**
     * #action
     */
    async fetchSessionStorageSession() {
      const sessionStr = sessionStorage.getItem('current')
      const query = self.sessionQuery!.replace('local-', '')

      // check if
      if (sessionStr) {
        const sessionSnap = JSON.parse(sessionStr).session || {}
        if (query === sessionSnap.id) {
          return this.setSessionSnapshot(sessionSnap)
        }
      }

      if (self.bc1) {
        self.bc1.postMessage(query)
        try {
          const result = await new Promise<Record<string, unknown>>(
            (resolve, reject) => {
              if (self.bc2) {
                self.bc2.onmessage = msg => {
                  resolve(msg.data)
                }
              }
              setTimeout(() => {
                reject(new Error('timeout'))
              }, 1000)
            },
          )
          await this.setSessionSnapshot({ ...result, id: nanoid() })
        } catch (e) {
          // the broadcast channels did not find the session in another tab
          // clear session param, so just ignore
        }
      }
      throw new Error('Local storage session not found')
    },
    /**
     * #action
     */
    async fetchSharedSession() {
      const defaultURL = 'https://share.jbrowse.org/api/v1/'
      const decryptedSession = await readSessionFromDynamo(
        // @ts-expect-error
        `${readConf(self.configSnapshot, 'shareURL', defaultURL)}load`,
        self.sessionQuery || '',
        self.password || '',
      )

      const session = JSON.parse(await fromUrlSafeB64(decryptedSession))
      await this.setSessionSnapshot({
        ...session,
        id: nanoid(),
      })
    },
    /**
     * #action
     */
    async decodeEncodedUrlSession() {
      const session = JSON.parse(
        // @ts-expect-error
        await fromUrlSafeB64(self.sessionQuery.replace('encoded-', '')),
      )
      await this.setSessionSnapshot({
        ...session,
        id: nanoid(),
      })
    },
    /**
     * #action
     */
    decodeSessionSpec() {
      if (!self.sessionQuery) {
        return
      }
      self.sessionSpec = JSON.parse(self.sessionQuery.replace('spec-', ''))
    },
    /**
     * #action
     */
    decodeJb1StyleSession() {
      const {
        loc,
        tracks,
        assembly,
        tracklist,
        nav,
        highlight,
        sessionTracksParsed: sessionTracks,
      } = self
      if (loc) {
        self.sessionSpec = {
          sessionTracks,
          views: [
            {
              type: 'LinearGenomeView',
              tracks: tracks?.split(','),
              sessionTracks,
              loc,
              assembly,
              tracklist,
              nav,
              highlight: highlight?.split(' '),
            },
          ],
        }
      }
    },

    /**
     * #action
     */
    decodeHubSpec() {
      const { hubURL, sessionTracksParsed: sessionTracks } = self

      self.hubSpec = {
        sessionTracks,
        hubURL,
      }
    },
    /**
     * #action
     */
    async decodeJsonUrlSession() {
      // @ts-expect-error
      const { session } = JSON.parse(self.sessionQuery.replace(/^json-/, ''))
      await this.setSessionSnapshot({
        ...session,
        id: nanoid(),
      })
    },
    /**
     * #aftercreate
     */
    afterCreate() {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      ;(async () => {
        try {
          await this.fetchConfig()

          addDisposer(
            self,
            autorun(async () => {
              try {
                const {
                  isLocalSession,
                  isEncodedSession,
                  isSpecSession,
                  isSharedSession,
                  isJsonSession,
                  isJb1StyleSession,
                  isHubSession,
                  sessionQuery,
                  configSnapshot,
                } = self
                if (!configSnapshot) {
                  return
                }

                if (self.bc1) {
                  self.bc1.onmessage = msg => {
                    const r =
                      JSON.parse(sessionStorage.getItem('current') || '{}')
                        .session || {}
                    if (r.id === msg.data && self.bc2) {
                      self.bc2.postMessage(r)
                    }
                  }
                }

                if (isSharedSession) {
                  await this.fetchSharedSession()
                } else if (isSpecSession) {
                  this.decodeSessionSpec()
                } else if (isJb1StyleSession) {
                  this.decodeJb1StyleSession()
                } else if (isEncodedSession) {
                  await this.decodeEncodedUrlSession()
                } else if (isHubSession) {
                  this.decodeHubSpec()
                  self.setBlankSession(true)
                } else if (isJsonSession) {
                  await this.decodeJsonUrlSession()
                } else if (isLocalSession) {
                  await this.fetchSessionStorageSession()
                } else if (sessionQuery) {
                  // if there was a sessionQuery and we don't recognize it
                  throw new Error('unrecognized session format')
                } else {
                  // placeholder for session loaded, but none found
                  self.setBlankSession(true)
                }
              } catch (e) {
                console.error(e)
                self.setSessionError(e)
              }
            }),
          )
        } catch (e) {
          console.error(e)
          self.setConfigError(e)
        }
      })()
    },
  }))

export type SessionLoaderModel = Instance<typeof SessionLoader>

export default SessionLoader
