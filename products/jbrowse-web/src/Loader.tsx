/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState, useCallback } from 'react'
import PluginManager from '@jbrowse/core/PluginManager'
import PluginLoader from '@jbrowse/core/PluginLoader'
import { inDevelopment, fromUrlSafeB64 } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import ErrorBoundary from 'react-error-boundary'
import {
  StringParam,
  useQueryParam,
  QueryParamProvider,
} from 'use-query-params'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { SnapshotOut } from 'mobx-state-tree'
import { PluginConstructor } from '@jbrowse/core/Plugin'
import { FatalErrorDialog } from '@jbrowse/core/ui'
import { TextDecoder, TextEncoder } from 'fastestsmallesttextencoderdecoder'
import * as crypto from 'crypto'
import 'typeface-roboto'
import 'requestidlecallback-polyfill'
import 'core-js/stable'
import shortid from 'shortid'
import history from './history'
import { readSessionFromDynamo } from './sessionSharing'
import Loading from './Loading'
import corePlugins from './corePlugins'
import JBrowse from './JBrowse'
import JBrowseRootModelFactory from './rootModel'
import packagedef from '../package.json'

if (!window.TextEncoder) {
  window.TextEncoder = TextEncoder
}
if (!window.TextDecoder) {
  window.TextDecoder = TextDecoder
}
function NoConfigMessage() {
  // TODO: Link to docs for how to configure JBrowse
  return (
    <>
      <h4>JBrowse has not been configured yet.</h4>
      {inDevelopment ? (
        <>
          <div>Available development configs:</div>
          <ul>
            <li>
              <a href="?config=test_data/config.json">Human basic</a>
            </li>
            <li>
              <a href="?config=test_data/config_demo.json">Human extended</a>
            </li>
            <li>
              <a href="?config=test_data/tomato/config.json">Tomato SVs</a>
            </li>
            <li>
              <a href="?config=test_data/volvox/config.json">Volvox</a>
            </li>
            <li>
              <a href="?config=test_data/breakpoint/config.json">Breakpoint</a>
            </li>
            <li>
              <a href="?config=test_data/config_dotplot.json">
                Grape/Peach Dotplot
              </a>
            </li>
            <li>
              <a href="?config=test_data/config_human_dotplot.json">
                hg19/hg38 Dotplot
              </a>
            </li>
            <li>
              <a href="?config=test_data/config_synteny_grape_peach.json">
                Grape/Peach Synteny
              </a>
            </li>
            <li>
              <a href="?config=test_data/yeast_synteny/config.json">
                Yeast Synteny
              </a>
            </li>
            <li>
              <a href="?config=test_data/config_longread.json">
                Long Read vs. Reference Dotplot
              </a>
            </li>
            <li>
              <a href="?config=test_data/config_longread_linear.json">
                Long Read vs. Reference Linear
              </a>
            </li>
            <li>
              <a href="?config=test_data/config_many_contigs.json">
                Many Contigs
              </a>
            </li>
            <li>
              <a href="?config=test_data/config_honeybee.json">Honeybee</a>
            </li>
          </ul>
        </>
      ) : null}
    </>
  )
}

type Config = SnapshotOut<AnyConfigurationModel>

export function Loader() {
  const bc1 =
    typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel('jb_request_session')
  const bc2 =
    typeof BroadcastChannel === 'undefined'
      ? null
      : new BroadcastChannel('jb_respond_session')
  const [configSnapshot, setConfigSnapshot] = useState<Config>()
  const [noDefaultConfig, setNoDefaultConfig] = useState(false)
  const [plugins, setPlugins] = useState<PluginConstructor[]>()

  const [configQueryParam] = useQueryParam('config', StringParam)
  const [sessionQueryParam, setSessionQueryParam] = useQueryParam(
    'session',
    StringParam,
  )
  const [passwordQueryParam, setPasswordQueryParam] = useQueryParam(
    'password',
    StringParam,
  )
  const [adminKeyParam] = useQueryParam('adminKey', StringParam)
  const loadingSharedSession = sessionQueryParam?.startsWith('share-')
  const [root, setRoot] = useState<any>()
  const [session, setSession] = useState<any>()
  const [, forceUpdate] = React.useReducer(x => x + 1, 0)
  const adminMode = adminKeyParam !== undefined

  // this history.listen and forceUpdate() are related to use-query-params,
  // because the setters from use-query-params don't cause a component rerender
  // if a router system is not used. see the no-router example here
  // https://github.com/pbeshai/use-query-params/blob/master/examples/no-router/src/App.js
  useEffect(() => {
    history.listen(() => {
      forceUpdate()
    })
  }, [])

  const setData = useCallback(
    function setData(data?: string) {
      setSessionQueryParam(data)
      setPasswordQueryParam(undefined)
    },
    [setSessionQueryParam, setPasswordQueryParam],
  )

  // on share link pasted, reads from dynamoDB to fetch and decode session
  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    async function readSharedSession() {
      if (sessionQueryParam && loadingSharedSession) {
        try {
          const key = crypto.createHash('sha256').update('JBrowse').digest()
          const decryptedSession = await readSessionFromDynamo(
            sessionQueryParam,
            key,
            passwordQueryParam || '',
            signal,
          )

          if (decryptedSession) {
            const fromShared = JSON.parse(fromUrlSafeB64(decryptedSession))
            sessionStorage.setItem('current', JSON.stringify(fromShared))
            setData(fromShared.id)
            setSession(fromShared)
          } else {
            // eslint-disable-next-line no-alert
            alert('Session could not be decrypted with given password')
            setData()
          }
        } catch (e) {
          if (!signal.aborted) {
            // eslint-disable-next-line no-alert
            alert(`Failed to find session in database: ${e}`)
            setData()
          }
        }
      }
    }
    readSharedSession()
    return () => {
      controller.abort()
    }
  }, [
    setData,
    loadingSharedSession,
    passwordQueryParam,
    sessionQueryParam,
    setPasswordQueryParam,
    setSessionQueryParam,
  ])

  // on local link posted, checks other tabs if they have session stored in sessionStorage
  useEffect(() => {
    ;(async () => {
      if (sessionQueryParam && !loadingSharedSession) {
        const sessionStorageSession = JSON.parse(
          sessionStorage.getItem('current') || '{}',
        )
        const foundLocalSession =
          localStorage.getItem(sessionQueryParam) ||
          (sessionStorageSession.id === sessionQueryParam
            ? sessionStorageSession
            : null)

        if (!foundLocalSession) {
          if (bc1) {
            bc1.postMessage(sessionQueryParam)
            try {
              const result = await new Promise((resolve, reject) => {
                if (bc2) {
                  bc2.onmessage = msg => {
                    resolve(msg.data)
                  }
                }
                setTimeout(() => reject(), 1000)
              })
              const id = shortid()
              // @ts-ignore
              result.id = id
              sessionStorage.setItem('current', JSON.stringify(result))
              setData(id)
            } catch (e) {
              // the broadcast channels did not find the session in another tab
              // clear session param
              setData()
            }
          }
        }
      }
    })()
  }, [
    bc1,
    bc2,
    setData,
    sessionQueryParam,
    setPasswordQueryParam,
    setSessionQueryParam,
    loadingSharedSession,
  ])

  useEffect(() => {
    async function fetchConfig() {
      const configLocation = {
        uri: configQueryParam || 'config.json',
        baseUri: '',
      }
      let configText = ''
      try {
        const location = openLocation(configLocation)
        configText = (await location.readFile('utf8')) as string
      } catch (error) {
        if (configQueryParam && configQueryParam !== 'config.json') {
          setConfigSnapshot(() => {
            throw new Error(`Problem loading config, "${error.message}"`)
          })
        } else {
          setNoDefaultConfig(true)
        }
      }
      let config
      if (configText) {
        try {
          config = JSON.parse(configText)
          const configUri = new URL(configLocation.uri, window.location.origin)
          addRelativeUris(config, configUri)
        } catch (error) {
          setConfigSnapshot(() => {
            throw new Error(`Can't parse config JSON: ${error.message}`)
          })
        }
        setConfigSnapshot(config)
      }
    }
    fetchConfig()
  }, [configQueryParam])

  useEffect(() => {
    async function fetchPlugins() {
      // Load runtime plugins
      if (configSnapshot) {
        try {
          const pluginLoader = new PluginLoader(configSnapshot.plugins)
          pluginLoader.installGlobalReExports(window)
          const runtimePlugins = await pluginLoader.load()
          setPlugins([...corePlugins, ...runtimePlugins])
        } catch (error) {
          setConfigSnapshot(() => {
            throw error
          })
        }
      }
    }
    fetchPlugins()
  }, [configSnapshot])

  useEffect(() => {
    const lastAutosave = localStorage.getItem('autosave')
    if (lastAutosave) {
      localStorage.setItem('localSaved-previousAutosave', lastAutosave)
    }
    if (sessionQueryParam) {
      const foundLocalSession = localStorage.getItem(sessionQueryParam)
      if (foundLocalSession) {
        setSession(JSON.parse(foundLocalSession).session)
      } else {
        const sessionStorageSession = sessionStorage.getItem('current')
        if (
          sessionStorageSession &&
          JSON.parse(sessionStorageSession).id === sessionQueryParam
        ) {
          setSession(JSON.parse(sessionStorageSession))
        }
      }
    }
  }, [loadingSharedSession, sessionQueryParam, setData])

  useEffect(() => {
    if ((!sessionQueryParam || session) && plugins !== undefined) {
      const pluginManager = new PluginManager(plugins.map(P => new P()))

      pluginManager.createPluggableElements()

      const JBrowseRootModel = JBrowseRootModelFactory(pluginManager, adminMode)

      let rootModel
      try {
        if (configSnapshot) {
          rootModel = JBrowseRootModel.create({
            jbrowse: configSnapshot,
            assemblyManager: {},
            version: packagedef.version,
          })
        }
      } catch (error) {
        // if it failed to load, it's probably a problem with the saved sessions,
        // so just delete them and try again
        try {
          console.error(error)
          console.warn(
            'deleting saved sessions and re-trying after receiving the above error',
          )
          rootModel = JBrowseRootModel.create({
            jbrowse: { ...configSnapshot },
            assemblyManager: {},
            version: packagedef.version,
          })
        } catch (e) {
          console.error(e)
          const additionalMsg =
            e.message.length > 10000 ? '... see console for more' : ''
          throw new Error(e.message.slice(0, 10000) + additionalMsg)
        }
      }
      if (!rootModel) {
        throw new Error('could not instantiate root model')
      }
      // in order: saves the previous autosave for recovery, tries to load the local session
      // if session in query, or loads the default session
      try {
        if (!sessionQueryParam) {
          rootModel.setDefaultSession()
        } else {
          rootModel.setSession(session)
        }
        if (!rootModel.session) {
          throw new Error('root model did not have any session defined')
        }
        // rootModel.setHistory(
        //   UndoManager.create({}, { targetStore: rootModel.session }),
        // )
      } catch (e) {
        console.error(e)
        if (e.message) {
          throw new Error(e.message.slice(0, 10000))
        } else {
          throw e
        }
      }
      // make some things available globally for testing
      // e.g. window.MODEL.views[0] in devtools
      // @ts-ignore
      window.MODEL = rootModel.session
      // @ts-ignore
      window.ROOTMODEL = rootModel
      pluginManager.setRootModel(rootModel)

      pluginManager.configure()
      setRoot(pluginManager)
    }
  }, [
    session,
    setData,
    configSnapshot,
    setPasswordQueryParam,
    setSessionQueryParam,
    sessionQueryParam,
    plugins,
    adminMode,
    loadingSharedSession,
  ])

  useEffect(() => {
    if (bc1) {
      bc1.onmessage = msg => {
        const ret = JSON.parse(sessionStorage.getItem('current') || '{}')
        if (ret.id === msg.data) {
          if (bc2) {
            bc2.postMessage(ret)
          }
        }
      }
    }
  }, [bc1, bc2])

  if (noDefaultConfig) {
    return <NoConfigMessage />
  }

  if (!root) {
    return <Loading />
  }

  return <JBrowse pluginManager={root} />
}

function addRelativeUris(config: Config, configUri: URL) {
  if (typeof config === 'object') {
    for (const key of Object.keys(config)) {
      if (typeof config[key] === 'object') {
        addRelativeUris(config[key], configUri)
      } else if (key === 'uri') {
        config.baseUri = configUri.href
      }
    }
  }
}

function factoryReset() {
  // @ts-ignore
  window.location = window.location.pathname
}
const PlatformSpecificFatalErrorDialog = (props: unknown) => {
  return <FatalErrorDialog onFactoryReset={factoryReset} {...props} />
}
export default () => {
  return (
    <ErrorBoundary FallbackComponent={PlatformSpecificFatalErrorDialog}>
      {/* @ts-ignore*/}
      <QueryParamProvider history={history}>
        <Loader />
      </QueryParamProvider>
    </ErrorBoundary>
  )
}
