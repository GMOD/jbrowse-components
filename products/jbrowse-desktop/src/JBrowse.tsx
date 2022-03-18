import React, { Suspense } from 'react'
import { observer } from 'mobx-react'
import { runInAction } from 'mobx'
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
    // @ts-ignore
    window.root = rootModel
    // @ts-ignore
    window.runInAction = runInAction

    return rootModel ? (
      <JBrowseNonNullRoot rootModel={rootModel as RootModel} />
    ) : null
  },
)

const JBrowseNonNullRoot = observer(
  ({ rootModel }: { rootModel: RootModel }) => {
    const { session, jbrowse, error, isAssemblyEditing, setAssemblyEditing } =
      rootModel

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
              {isAssemblyEditing ? (
                <AssemblyManager
                  rootModel={rootModel}
                  onClose={() => {
                    setAssemblyEditing(false)
                  }}
                />
              ) : null}
            </Suspense>
          </>
        ) : (
          <div>No session</div>
        )}
      </ThemeProvider>
    )
  },
)

export default JBrowse
