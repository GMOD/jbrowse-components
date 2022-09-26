import React, { Suspense } from 'react'
import { observer } from 'mobx-react'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'

// jbrowse
import { getConf } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { App } from '@jbrowse/app-core'
import PluginManager from '@jbrowse/core/PluginManager'
import { AssemblyManager } from '@jbrowse/plugin-data-management'

// styles
import './JBrowse.css'

// locals
import { RootModel } from './rootModel'

// without this, the styles can become messed up
// xref https://github.com/garronej/tss-react/issues/25
export const muiCache = createCache({
  key: 'mui',
  prepend: true,
})

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
    const { session, jbrowse, error, isAssemblyEditing, setAssemblyEditing } =
      rootModel

    if (error) {
      throw error
    }

    const theme = getConf(jbrowse, 'theme')

    return (
      <CacheProvider value={muiCache}>
        <ThemeProvider theme={createJBrowseTheme(theme)}>
          <CssBaseline />
          {session ? (
            <>
              <App session={session} />
              <Suspense fallback={<div />}>
                {isAssemblyEditing ? (
                  <AssemblyManager
                    rootModel={rootModel}
                    onClose={() => setAssemblyEditing(false)}
                  />
                ) : null}
              </Suspense>
            </>
          ) : (
            <div>No session</div>
          )}
        </ThemeProvider>
      </CacheProvider>
    )
  },
)

export default JBrowse
