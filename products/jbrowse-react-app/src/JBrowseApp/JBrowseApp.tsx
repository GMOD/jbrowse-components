import React, { Suspense, lazy } from 'react'
import { getConf } from '@jbrowse/core/configuration'
import { LoadingEllipses, createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider, ScopedCssBaseline } from '@mui/material'
import { observer } from 'mobx-react'
import { makeStyles } from 'tss-react/mui'

// locals
import type { ViewModel } from '../createModel'

const App = lazy(() => import('./AppReExport'))

const useStyles = makeStyles()({
  // avoid parent styles getting into this div
  // https://css-tricks.com/almanac/properties/a/all/
  avoidParentStyle: {
    all: 'initial',
  },
})

const JBrowseApp = observer(function ({ viewState }: { viewState: ViewModel }) {
  const { classes } = useStyles()
  const session = viewState.session
  const theme = createJBrowseTheme(getConf(viewState.jbrowse, 'theme'))

  return (
    <ThemeProvider theme={theme}>
      <div className={classes.avoidParentStyle}>
        <ScopedCssBaseline>
          <Suspense fallback={<LoadingEllipses />}>
            <App session={session} />
          </Suspense>
        </ScopedCssBaseline>
      </div>
    </ThemeProvider>
  )
})

export default JBrowseApp
