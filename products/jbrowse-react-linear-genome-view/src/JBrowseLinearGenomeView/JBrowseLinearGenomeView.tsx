import { Suspense } from 'react'

import { readConfObject } from '@jbrowse/core/configuration'
import { LoadingEllipses, createJBrowseTheme } from '@jbrowse/core/ui'
import { EmbeddedViewContainer, ModalWidget } from '@jbrowse/embedded-core'
import { getEnv } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'

import type { ViewModel } from '../createModel/createModel'

const JBrowseLinearGenomeView = observer(function ({
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

export default JBrowseLinearGenomeView
