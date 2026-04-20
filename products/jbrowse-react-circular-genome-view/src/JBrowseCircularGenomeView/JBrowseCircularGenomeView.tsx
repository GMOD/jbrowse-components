import { Suspense } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { LoadingEllipses, createJBrowseTheme } from '@jbrowse/core/ui'
import { getEnv } from '@jbrowse/core/util'
import { EmbeddedViewContainer, ModalWidget } from '@jbrowse/embedded-core'
import { ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import type { ViewModel } from '../createModel/createModel.ts'

const JBrowseCircularGenomeView = observer(function JBrowseCircularGenomeView({
  viewState,
}: {
  viewState: ViewModel
}) {
  const { session } = viewState
  const { view } = session
  const { pluginManager } = getEnv(session)
  const { ReactComponent } = pluginManager.getViewType(view.type)!
  const theme = createJBrowseTheme(
    readConfObject(viewState.config.configuration, 'theme'),
  )

  return (
    <ThemeProvider theme={theme}>
      <EmbeddedViewContainer key={`view-${view.id}`} view={view}>
        <Suspense fallback={<LoadingEllipses />}>
          <ReactComponent model={view} session={session} />
        </Suspense>
      </EmbeddedViewContainer>
      {/* @ts-expect-error see comments on interface for AbstractSessionModel */}
      <ModalWidget session={session} />
    </ThemeProvider>
  )
})

export default JBrowseCircularGenomeView
