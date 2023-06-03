import React, { Suspense } from 'react'
import { ThemeProvider } from '@mui/material'
import { observer } from 'mobx-react'
import { getEnv } from '@jbrowse/core/util'
import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { EmbeddedViewContainer, ModalWidget } from '@jbrowse/embedded-core'

// locals
import { ViewModel } from '../createModel/createModel'

const JBrowseCircularGenomeView = observer(function ({
  viewState,
}: {
  viewState: ViewModel
}) {
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
    <ThemeProvider theme={theme}>
      <EmbeddedViewContainer key={`view-${view.id}`} view={view}>
        <Suspense fallback={<div>Loading...</div>}>
          <ReactComponent model={view} session={session} />
        </Suspense>
      </EmbeddedViewContainer>
      <ModalWidget session={session} />
    </ThemeProvider>
  )
})

export default JBrowseCircularGenomeView
