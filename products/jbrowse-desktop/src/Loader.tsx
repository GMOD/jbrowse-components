import PluginManager from '@jbrowse/core/PluginManager'
import CircularProgress from '@material-ui/core/CircularProgress'
import { makeStyles } from '@material-ui/core/styles'
import React, { useEffect, useState } from 'react'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'
import { SnapshotIn } from 'mobx-state-tree'
import PluginLoader from '@jbrowse/core/PluginLoader'

import {
  writeAWSAnalytics,
  writeGAAnalytics,
} from '@jbrowse/core/util/analytics'
import { readConfObject } from '@jbrowse/core/configuration'
import factoryReset from './factoryReset'
import corePlugins from './corePlugins'
import JBrowse from './JBrowse'
import JBrowseRootModelFactory from './rootModel'
import packagedef from '../package.json'

const { electron } = window

const useStyles = makeStyles({
  loadingIndicator: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    marginTop: -25,
    marginLeft: -25,
  },
})

export default function Loader({
  initialTimestamp,
}: {
  initialTimestamp: number
}) {
  const [configSnapshot, setConfigSnapshot] = useState<
    SnapshotIn<AnyConfigurationModel>
  >()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [plugins, setPlugins] = useState<any[]>([])
  const classes = useStyles()
  const [error, setError] = useState('')
  const [snapshotError, setSnapshotError] = useState('')
  const [pluginManager, setPluginManager] = useState<PluginManager>()

  useEffect(() => {
    const ipcRenderer = (electron && electron.ipcRenderer) || {
      invoke: () => {},
    }
    async function fetchConfig() {
      try {
        setConfigSnapshot(
          Object.assign(await ipcRenderer.invoke('loadConfig'), {
            configuration: { rpc: { defaultDriver: 'ElectronRpcDriver' } },
          }),
        )
      } catch (e) {
        // used to launch an error dialog for whatever caused loadConfig to
        // fail
        setConfigSnapshot(() => {
          throw e
        })
      }
    }

    fetchConfig()
  }, [])

  useEffect(() => {
    async function fetchPlugins() {
      // Load runtime plugins
      if (configSnapshot) {
        try {
          const pluginLoader = new PluginLoader(configSnapshot.plugins)
          pluginLoader.installGlobalReExports(window)
          const runtimePlugins = await pluginLoader.load()
          setPlugins([
            ...corePlugins.map(P => ({
              plugin: new P(),
              metadata: { isCore: true },
            })),
            ...runtimePlugins.map(P => new P()),
          ])
        } catch (e) {
          // used to launch an error dialog for whatever caused plugin loading
          // to fail
          setConfigSnapshot(() => {
            throw e
          })
        }
      }
    }
    fetchPlugins()
  }, [configSnapshot])

  useEffect(() => {
    if (plugins.length > 0) {
      const pm = new PluginManager(plugins)
      pm.createPluggableElements()

      const JBrowseRootModel = JBrowseRootModelFactory(pm)
      try {
        if (configSnapshot) {
          const rootModel = JBrowseRootModel.create(
            {
              jbrowse: configSnapshot,
              assemblyManager: {},
              version: packagedef.version,
            },
            { pluginManager: pm },
          )
          rootModel.jbrowse.configuration.rpc.addDriverConfig(
            'ElectronRpcDriver',
            { type: 'ElectronRpcDriver' },
          )
          rootModel.jbrowse.configuration.rpc.defaultDriver.set(
            'ElectronRpcDriver',
          )
          // make some things available globally for testing
          // e.g. window.MODEL.views[0] in devtools
          // @ts-ignore
          window.MODEL = rootModel.session
          // @ts-ignore
          window.ROOTMODEL = rootModel
          pm.setRootModel(rootModel)

          pm.configure()

          if (
            rootModel &&
            !readConfObject(rootModel.jbrowse.configuration, 'disableAnalytics')
          ) {
            writeAWSAnalytics(rootModel, initialTimestamp)
            writeGAAnalytics(rootModel, initialTimestamp)
          }
          setPluginManager(pm)
        }
      } catch (e) {
        console.error(e)
        const match = e.message.match(
          /.*at path "(.*)" snapshot `(.*)` is not assignable/,
        )
        // best effort to make a better error message than the default
        // mobx-state-tree
        if (match) {
          setError(`Failed to load element at ${match[1]}`)
          setSnapshotError(match[2])
        } else {
          const additionalMsg =
            e.message.length > 10000 ? '... see console for more' : ''
          throw new Error(e.message.slice(0, 10000) + additionalMsg)
        }
        console.error(e)
      }
    }
  }, [plugins, configSnapshot, initialTimestamp])

  if (!(configSnapshot && plugins && pluginManager) && !error) {
    return (
      <CircularProgress
        disableShrink
        className={classes.loadingIndicator}
        size={50}
      />
    )
  }

  const err = error

  if (err) {
    return (
      <div>
        {err ? (
          <div
            style={{
              border: '1px solid black',
              padding: 2,
              margin: 2,
              backgroundColor: '#ff8888',
            }}
          >
            {`${err}`}
            {snapshotError ? (
              <>
                {' '}
                ... Failed element had snapshot:
                <pre
                  style={{
                    background: 'lightgrey',
                    border: '1px solid black',
                    maxHeight: 200,
                    overflow: 'auto',
                    margin: 20,
                  }}
                >
                  {JSON.stringify(JSON.parse(snapshotError), null, 2)}
                </pre>
              </>
            ) : null}
          </div>
        ) : null}
        <button type="button" onClick={() => factoryReset()}>
          Factory reset
        </button>
      </div>
    )
  }

  return <JBrowse pluginManager={pluginManager} />
}
