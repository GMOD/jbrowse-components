import React from 'react'
import { observer } from 'mobx-react'
import { ThemeProvider, ScopedCssBaseline } from '@mui/material'
import { makeStyles } from 'tss-react/mui'

// locals
import App from '@jbrowse/core/ui/App'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getConf } from '@jbrowse/core/configuration'

const useStyles = makeStyles()({
  // avoid parent styles getting into this div
  // https://css-tricks.com/almanac/properties/a/all/
  avoidParentStyle: {
    all: 'initial',
  },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default observer(function ({ viewState }: { viewState: any }) {
  const { classes } = useStyles()

  const session = viewState?.session
  const theme = createJBrowseTheme(getConf(viewState.jbrowse, 'theme'))

  return (
    <ThemeProvider theme={theme}>
      <div className={classes.avoidParentStyle}>
        <ScopedCssBaseline>
          <App session={session} />
        </ScopedCssBaseline>
      </div>
    </ThemeProvider>
  )
})
