import React, { useEffect, useState, Suspense } from 'react'
import { observer } from 'mobx-react'
import { CssBaseline, ThemeProvider } from '@material-ui/core'
import { getConf } from '@jbrowse/core/configuration'
import { App, createJBrowseTheme } from '@jbrowse/core/ui'
import PluginManager from '@jbrowse/core/PluginManager'
import { AssemblyManager } from '@jbrowse/plugin-data-management'

// locals
import { RootModel } from './rootModel'

const JBrowse = observer(
  ({ pluginManager }: { pluginManager: PluginManager }) => {
    const { rootModel } = pluginManager

    return rootModel ? (
      <JBrowseNonNullRoot rootModel={rootModel as RootModel} />
    ) : null
  },
)

const JBrowseNonNullRoot = observer(
  ({ rootModel }: { rootModel: RootModel }) => {
    const [firstLoad, setFirstLoad] = useState(true)
    const {
      session,
      jbrowse,
      error,
      isAssemblyEditing,
      setAssemblyEditing,
    } = rootModel

    useEffect(() => {
      if (firstLoad && session) {
        setFirstLoad(false)
      }
    }, [firstLoad, session])

    if (error) {
      throw error
    }

    const theme = getConf(jbrowse, 'theme')

    return (
      <ThemeProvider theme={createJBrowseTheme(theme)}>
        <CssBaseline />
        {session ? (
          <>
            <App session={session} />
            <Suspense fallback={<div />}>
              <AssemblyManager
                rootModel={rootModel}
                open={isAssemblyEditing}
                onClose={() => {
                  setAssemblyEditing(false)
                }}
              />
            </Suspense>
          </>
        ) : null}
      </ThemeProvider>
    )
  },
)

export default JBrowse
