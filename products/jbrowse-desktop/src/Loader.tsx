import React, { useState, useCallback, useEffect } from 'react'
import { observer } from 'mobx-react'
import PluginManager from '@jbrowse/core/PluginManager'
import { CssBaseline, ThemeProvider, makeStyles } from '@material-ui/core'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { StringParam, useQueryParam } from 'use-query-params'
import { ipcRenderer } from 'electron'
import { loadPluginManager } from './StartScreen/util'

import JBrowse from './JBrowse'
import StartScreen from './StartScreen'

const useStyles = makeStyles(theme => ({
  message: {
    border: '1px solid black',
    overflow: 'auto',
    maxHeight: 200,
    margin: theme.spacing(1),
    padding: theme.spacing(1),
  },

  errorBox: {
    background: 'lightgrey',
    border: '1px solid black',
    margin: 20,
  },
}))

const ErrorMessage = ({
  error,
  snapshotError,
}: {
  error: unknown
  snapshotError?: string
}) => {
  const classes = useStyles()
  return (
    <div className={classes.message} style={{ background: '#f88' }}>
      {`${error}`}
      {snapshotError ? (
        <>
          ... Failed element had snapshot:
          <pre className={classes.errorBox}>
            {JSON.stringify(JSON.parse(snapshotError), null, 2)}
          </pre>
        </>
      ) : null}
    </div>
  )
}

const Loader = observer(() => {
  const [pluginManager, setPluginManager] = useState<PluginManager>()
  const [config, setConfig] = useQueryParam('config', StringParam)
  const [error, setError] = useState<unknown>()
  const [snapshotError, setSnapshotError] = useState('')

  function handleError(e: unknown) {
    const str = `${e}`
    const match = str.match(
      /.*at path "(.*)" snapshot `(.*)` is not assignable/,
    )

    // best effort to make a better error message than the default
    // mobx-state-tree
    if (match) {
      setError(new Error(`Failed to load element at ${match[1]}`))
      setSnapshotError(match[2])
    } else {
      setError(new Error(str.slice(0, 10000)))
    }
    console.error(e)
  }

  const handleSetPluginManager = useCallback(
    (pm: PluginManager) => {
      // @ts-ignore
      pm.rootModel?.setOpenNewSessionCallback(async () => {
        const path = await ipcRenderer.invoke('promptOpenFile')
        if (path) {
          handleSetPluginManager(await loadPluginManager(path))
        }
      })

      // @ts-ignore
      setPluginManager(pm)
      setError(undefined)
      setSnapshotError('')
      setConfig('')
    },
    [setConfig],
  )

  useEffect(() => {
    ;(async () => {
      if (config) {
        try {
          handleSetPluginManager(await loadPluginManager(config))
        } catch (e) {
          handleError(e)
        }
      }
    })()
  }, [config, handleSetPluginManager])

  return (
    <ThemeProvider theme={createJBrowseTheme()}>
      <CssBaseline />

      {error ? (
        <ErrorMessage error={error} snapshotError={snapshotError} />
      ) : null}
      {pluginManager?.rootModel?.session ? (
        <JBrowse pluginManager={pluginManager} />
      ) : !config || error ? (
        <StartScreen
          setError={handleError}
          setPluginManager={handleSetPluginManager}
        />
      ) : null}
    </ThemeProvider>
  )
})

export default Loader
