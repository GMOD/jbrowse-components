import React, { Suspense, lazy } from 'react'
import { observer } from 'mobx-react'
import { ThemeProvider, ScopedCssBaseline } from '@mui/material'
import { LoadingEllipses, createJBrowseTheme } from '@jbrowse/core/ui'
import { getConf } from '@jbrowse/core/configuration'
import { makeStyles } from 'tss-react/mui'

// locals
import { ViewModel } from '../createModel'

const App = lazy(() => import('./AppReExport'))

const useStyles = makeStyles()({
  // avoid parent styles getting into this div
  // https://css-tricks.com/almanac/properties/a/all/
  avoidParentStyle: {
    all: 'initial',
  },
})

export default observer(function ({ viewState }: { viewState: ViewModel }) {
  const { classes } = useStyles()
  const session = viewState?.session
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
