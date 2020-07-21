import PluginManager from '@gmod/jbrowse-core/PluginManager'
import PluginLoader from '@gmod/jbrowse-core/PluginLoader'
import { inDevelopment, fromUrlSafeB64 } from '@gmod/jbrowse-core/util'
import { openLocation } from '@gmod/jbrowse-core/util/io'
import CircularProgress from '@material-ui/core/CircularProgress'
import { makeStyles } from '@material-ui/core/styles'
import { UndoManager } from 'mst-middlewares'
import React, { useEffect, useState } from 'react'
import { StringParam, useQueryParam } from 'use-query-params'
import { AnyConfigurationModel } from '@gmod/jbrowse-core/configuration/configurationSchema'
import { getConf } from '@gmod/jbrowse-core/configuration'
import { SnapshotOut } from 'mobx-state-tree'
import { PluginConstructor } from '@gmod/jbrowse-core/Plugin'
import corePlugins from './corePlugins'
import JBrowse from './JBrowse'
import JBrowseRootModelFactory from './rootModel'

const useStyles = makeStyles({
  loadingIndicator: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    marginTop: -25,
    marginLeft: -25,
  },
})

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
                Grape/Peach Syteny
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

export default function Loader() {
  const [configSnapshot, setConfigSnapshot] = useState<
    SnapshotOut<AnyConfigurationModel>
  >()
  const [noDefaultConfig, setNoDefaultConfig] = useState(false)
  const [plugins, setPlugins] = useState<PluginConstructor[]>()

  const [configQueryParam] = useQueryParam('config', StringParam)
  const [sessionQueryParam] = useQueryParam('session', StringParam)
  const [adminQueryParam] = useQueryParam('admin', StringParam)
  const adminMode = adminQueryParam === '1' || adminQueryParam === 'true'

  const classes = useStyles()

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
    return (
      <CircularProgress
        disableShrink
        className={classes.loadingIndicator}
        size={50}
      />
    )
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
      const savedSessionIndex = rootModel.jbrowse.savedSessionNames.indexOf(
        sessionQueryParam,
      )
      if (getConf(rootModel.jbrowse, 'useUrlSession')) {
        if (savedSessionIndex !== -1) {
          rootModel.setSession(
            rootModel.jbrowse.savedSessions[savedSessionIndex],
          )
        } else {
          rootModel.setSession(JSON.parse(fromUrlSafeB64(sessionQueryParam)))
        }
      }
    } else {
      const localStorageSession = localStorage.getItem('jbrowse-web-session')
      if (localStorageSession) {
        if (getConf(rootModel.jbrowse, 'useLocalStorage')) {
          rootModel.setSession(JSON.parse(localStorageSession))
        }
      }
    }
    if (!rootModel.session) {
      if (rootModel.jbrowse && rootModel.jbrowse.savedSessions.length) {
        const { name } = rootModel.jbrowse.savedSessions[0]
        rootModel.activateSession(name)
      } else {
        rootModel.setDefaultSession()
      }
    }

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

  return <JBrowse pluginManager={pluginManager} />
}
