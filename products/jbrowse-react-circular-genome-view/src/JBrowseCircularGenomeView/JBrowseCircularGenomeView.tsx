import { Suspense, useMemo } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { LoadingEllipses, createJBrowseTheme } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { EmbeddedViewContainer, ModalWidget } from '@jbrowse/embedded-core'
import { ScopedCssBaseline, ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import type { ViewModel } from '../createModel/createModel.ts'

const useStyles = makeStyles()({
  avoidParentStyle: {
    all: 'initial',
    display: 'block',
    width: '100%',
    height: '100%',
  },
})

const JBrowseCircularGenomeView = observer(function JBrowseCircularGenomeView({
  viewState,
}: {
  viewState: ViewModel
}) {
  const { session } = viewState
  const { view } = session
  const { pluginManager } = getEnv(session)
  const { ReactComponent } = pluginManager.getViewType(view.type)!
  const themeConfig = readConfObject(viewState.config.configuration, 'theme')
  const theme = useMemo(() => createJBrowseTheme(themeConfig), [themeConfig])
  const { classes } = useStyles()

  return (
    <ThemeProvider theme={theme}>
      <div className={classes.avoidParentStyle}>
        <ScopedCssBaseline>
          <EmbeddedViewContainer key={`view-${view.id}`} view={view}>
            <Suspense fallback={<LoadingEllipses />}>
              <ReactComponent model={view} session={session} />
            </Suspense>
          </EmbeddedViewContainer>
          <ModalWidget session={session} />
        </ScopedCssBaseline>
      </div>
    </ThemeProvider>
  )
})

export default JBrowseCircularGenomeView
