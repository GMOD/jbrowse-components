import React, { useState, useCallback, useEffect } from 'react'
import { observer } from 'mobx-react'
import PluginManager from '@jbrowse/core/PluginManager'
import { CssBaseline, ThemeProvider, makeStyles } from '@material-ui/core'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { StringParam, useQueryParam } from 'use-query-params'
import { ipcRenderer } from 'electron'
import { createPluginManager } from './StartScreen/util'

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
  error: Error
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
  const [error, setError] = useState<Error>()
  const [snapshotError, setSnapshotError] = useState('')

  function handleError(e: Error) {
    const match = e.message.match(
      /.*at path "(.*)" snapshot `(.*)` is not assignable/,
    )

    // best effort to make a better error message than the default
    // mobx-state-tree
    if (match) {
      setError(new Error(`Failed to load element at ${match[1]}`))
      setSnapshotError(match[2])
    } else {
      setError(new Error(e.message.slice(0, 10000)))
    }
    console.error(e)
  }

  const handleSetPluginManager = useCallback(
    (pm: PluginManager) => {
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
          const data = await ipcRenderer.invoke('loadSession', config)
          const pm = await createPluginManager(data)
          handleSetPluginManager(pm)
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
