import PluginManager from '@gmod/jbrowse-core/PluginManager'
import PluginLoader from '@gmod/jbrowse-core/PluginLoader'
import { inDevelopment, fromUrlSafeB64 } from '@gmod/jbrowse-core/util'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import ErrorBoundary from 'react-error-boundary'
import { UndoManager } from 'mst-middlewares'
import React, { useEffect, useState } from 'react'
import {
  StringParam,
  useQueryParam,
  QueryParamProvider,
} from 'use-query-params'
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import { SnapshotOut } from 'mobx-state-tree'
import { PluginConstructor } from '@gmod/jbrowse-core/Plugin'
import { FatalErrorDialog } from '@gmod/jbrowse-core/ui'
import { TextDecoder, TextEncoder } from 'fastestsmallesttextencoderdecoder'
import CircularProgress from '@material-ui/core/CircularProgress'
import * as crypto from 'crypto'
import 'typeface-roboto'
import 'requestidlecallback-polyfill'
import 'mobx-react/batchingForReactDom'
import 'core-js/stable'
import * as uuid from 'uuid'
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

interface DynamoDbSession {
  session?: string
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
  const [sessString, setSessString] = useState('')
  const [adminQueryParam] = useQueryParam('admin', StringParam)
  const [loadingState, setLoadingState] = useState(false)
  const [key] = useState(crypto.createHash('sha256').update('JBrowse').digest())
  const adminMode = adminQueryParam === '1' || adminQueryParam === 'true'
  const loadingSharedSession = sessionQueryParam?.startsWith('share-')

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    // adapted decrypt from https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
    function decrypt(text: string) {
      if (!passwordQueryParam) return ''
      const iv = Buffer.from(passwordQueryParam, 'hex')
      const encryptedText = Buffer.from(text, 'hex')
      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(key),
        iv,
      )
      let decrypted = decipher.update(encryptedText)
      decrypted = Buffer.concat([decrypted, decipher.final()])
      return decrypted.toString()
    }

    async function readSessionFromDynamo() {
      if (loadingSharedSession && sessionQueryParam && passwordQueryParam) {
        const sessionId = sessionQueryParam.split('share-')[1]
        const url = new URL(
          'https://g5um1mrb0i.execute-api.us-east-1.amazonaws.com/api/v1/load',
        )
        const params = new URLSearchParams(url.search)
        params.set('sessionId', sessionId)
        url.search = params.toString()

        setLoadingState(true)
        // TODOSESSION remove all references to savedSessions
        let response
        try {
          response = await fetch(url.href, {
            method: 'GET',
            mode: 'cors',
            signal,
          })
        } catch (error) {
          if (!signal.aborted) {
            // ignore
          }
        }

        if (response && response.ok) {
          const json = await response.json()
          const localId = `local-${uuid.v4()}`
          const decryptedSession = decrypt(json.session)
          localStorage.setItem(localId, fromUrlSafeB64(decryptedSession))
          setSessionQueryParam(localId)
          setPasswordQueryParam(undefined)
          setSessString(localId) // setting querys do not count for change rerender
        } else {
          // eslint-disable-next-line no-alert
          alert('Failed to find session')
          setSessionQueryParam(undefined)
          setPasswordQueryParam(undefined)
          setSessString('') // setting querys do not count for change rerender
        }
      }
    }
    readSessionFromDynamo()
    return () => {
      controller.abort()
      setLoadingState(false)
    }
  }, [
    loadingSharedSession,
    sessionQueryParam,
    setSessionQueryParam,
    passwordQueryParam,
    setPasswordQueryParam,
    sessString,
    key,
  ])

  useEffect(() => {
    async function fetchConfig() {
      const configLocation = {
        uri: configQueryParam || 'config.json',
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

  if (noDefaultConfig) {
    return <NoConfigMessage />
  }

  if (!(configSnapshot && plugins)) {
    return <Loading />
  }

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
        jbrowse: { ...configSnapshot, savedSessions: [] },
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
  try {
    if (sessionQueryParam) {
      // eslint-disable-next-line guard-for-in
      const foundLocalSession = localStorage.getItem(sessionQueryParam)
      if (foundLocalSession) {
        rootModel.setSession(JSON.parse(foundLocalSession))
      } else if (!loadingSharedSession) {
        // eslint-disable-next-line no-alert
        alert('No matching local session found')
        setSessionQueryParam(undefined)
        setPasswordQueryParam(undefined)
        setSessString('')
      }
    } else {
      rootModel.setDefaultSession()
      const localId = `local-${uuid.v4()}`
      localStorage.setItem(localId, JSON.stringify(rootModel.session))
      setSessionQueryParam(localId)
      setPasswordQueryParam(undefined)
      setSessString(localId)
    }

    if (!rootModel.session) return null
    rootModel.setHistory(
      UndoManager.create({}, { targetStore: rootModel.session }),
    )
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

  return loadingState ? (
    <CircularProgress />
  ) : (
    <JBrowse pluginManager={pluginManager} />
  )
}

function factoryReset() {
  localStorage.removeItem('jbrowse-web-data')
  localStorage.removeItem('jbrowse-web-session')
  // @ts-ignore
  window.location = window.location.pathname
}
const PlatformSpecificFatalErrorDialog = (props: unknown) => {
  return <FatalErrorDialog onFactoryReset={factoryReset} {...props} />
}
// if(loadingState) { return <CircularProgress /> } put in render return
export default () => {
  return (
    <ErrorBoundary FallbackComponent={PlatformSpecificFatalErrorDialog}>
      <QueryParamProvider>
        <Loader />
      </QueryParamProvider>
    </ErrorBoundary>
  )
}
