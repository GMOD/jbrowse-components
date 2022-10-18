import React, { Suspense } from 'react'
import { observer } from 'mobx-react'
import { getEnv } from '@jbrowse/core/util'
import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material/styles'
import { ScopedCssBaseline } from '@mui/material'
import { makeStyles } from 'tss-react/mui'
import { CacheProvider } from '@emotion/react'
import createCache from '@emotion/cache'

import ModalWidget from './ModalWidget'
import ViewContainer from './ViewContainer'
import { ViewModel } from '../createModel/createModel'

const useStyles = makeStyles()({
  // avoid parent styles getting into this div
  // https://css-tricks.com/almanac/properties/a/all/
  avoidParentStyle: {
    all: 'initial',
  },
})

// without this, the styles can become messed up
// xref https://github.com/garronej/tss-react/issues/25
export const muiCache = createCache({
  key: 'mui',
  prepend: true,
})

const JBrowseCircularGenomeView = observer(
  ({ viewState }: { viewState: ViewModel }) => {
    const { classes } = useStyles()
    const { session } = viewState
    const { view } = session
    const { pluginManager } = getEnv(session)
    const viewType = pluginManager.getViewType(view.type)
    if (!viewType) {
      throw new Error(`unknown view type ${view.type}`)
    }
    const { ReactComponent } = viewType
    const theme = createJBrowseTheme(
      readConfObject(viewState.config.configuration, 'theme'),
    )

    return (
      <CacheProvider value={muiCache}>
        <ThemeProvider theme={theme}>
          <div className={classes.avoidParentStyle}>
            <ScopedCssBaseline>
              <ViewContainer key={`view-${view.id}`} view={view}>
                <Suspense fallback={<div>Loading...</div>}>
                  <ReactComponent model={view} session={session} />
                </Suspense>
              </ViewContainer>
              <ModalWidget session={session} />
            </ScopedCssBaseline>
          </div>
        </ThemeProvider>
      </CacheProvider>
    )
  },
)

export default JBrowseCircularGenomeView
