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
  const bc1 = new BroadcastChannel('request_session')
  const bc2 = new BroadcastChannel('respond_session')
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
  const [loadingState, setLoadingState] = useState(false)
  const [key] = useState(crypto.createHash('sha256').update('JBrowse').digest())
  const [adminKeyParam] = useQueryParam('adminKey', StringParam)
  const adminMode = adminKeyParam !== undefined
  const loadingSharedSession = sessionQueryParam?.startsWith('share-')

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    // adapted decrypt from https://gist.github.com/vlucas/2bd40f62d20c1d49237a109d491974eb
    function decrypt(text: string) {
      if (!passwordQueryParam) return ''
      try {
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
      } catch (e) {
        // error
        return ''
      }
    }

    function setData(data?: string) {
      setSessionQueryParam(data)
      setPasswordQueryParam(undefined)
      setSessString(data || '') // setting querys do not count for change rerender
    }

    async function readSessionFromDynamo() {
      if (loadingSharedSession && sessionQueryParam) {
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

        let localId
        if (response && response.ok) {
          const json = await response.json()
          const decryptedSession = decrypt(json.session)
          if (decryptedSession) {
            localId = `localUnsaved-${uuid.v4()}`
            const fromShared = JSON.parse(fromUrlSafeB64(decryptedSession))
            fromShared.name = `${fromShared.name}-${new Date(
              Date.now(),
            ).toISOString()}`
            sessionStorage.setItem(localId, JSON.stringify(fromShared))
            setData(localId)
          } else {
            // eslint-disable-next-line no-alert
            alert('Session could not be decrypted with given password')
            setData()
          }
        } else {
          // eslint-disable-next-line no-alert
          alert('Failed to find given session in database')
          setData()
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
    function setData(data?: string) {
      setSessionQueryParam(data)
      setPasswordQueryParam(undefined)
      setSessString(data || '') // setting querys do not count for change rerender
    }
    ;(async () => {
      if (sessionQueryParam) {
        const foundLocalSession =
          localStorage.getItem(sessionQueryParam) ||
          sessionStorage.getItem(sessionQueryParam)

        if (!foundLocalSession) {
          bc1.postMessage(sessionQueryParam)
          const result = await new Promise((resolve, reject) => {
            bc2.onmessage = msg => {
              resolve(msg.data)
            }
            setTimeout(() => {
              reject()
            }, 1000)
          })
          const localId = `localSession-${uuid.v4()}`
          sessionStorage.setItem(localId, result as string)
          setData(localId)
        }
      }
    })()
  }, [bc1, bc2, sessionQueryParam, setPasswordQueryParam, setSessionQueryParam])

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
  // wrap below in useeffect, maybe set an error state
  // in the use effect callback, setState(() => throw new Error('My error'))
  try {
    // if statement, if there is an autosave with a session pop up a dialog box
    // window.confirm ask if they want to load autosave or not
    // if they load autosave, skip the rest of this try, or just continue on if they click no
    // only do if there is no specific sessionQueryParam in url when pasted (so this doesnt happen on refresh)

    if (sessionQueryParam) {
      // eslint-disable-next-line guard-for-in
      const foundLocalSession =
        localStorage.getItem(sessionQueryParam) ||
        sessionStorage.getItem(sessionQueryParam)
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
      let result
      if (localStorage.getItem('autosave')) {
        // eslint-disable-next-line no-alert
        result = window.confirm(
          'An unsaved session was located in autosave. Would you like to load this session?',
        )
      }
      const localId = result
        ? rootModel.loadAutosaveSession()
        : rootModel.setDefaultSession()
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

  bc1.onmessage = msg => {
    const ret = sessionStorage.getItem(msg.data)
    if (ret) {
      bc2.postMessage(ret)
    }
  }

  return loadingState ? (
    <CircularProgress />
  ) : (
    <JBrowse pluginManager={pluginManager} />
  )
}

function factoryReset() {
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
