import React, { Suspense } from 'react'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { readConfObject } from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { ThemeProvider } from '@mui/material/styles'
import { makeStyles } from 'tss-react/mui'

import ScopedCssBaseline from '@mui/material/ScopedCssBaseline'
import ModalWidget from './ModalWidget'
import ViewContainer from './ViewContainer'
import { ViewModel } from '../createModel/createModel'

const useStyles = makeStyles()(() => ({
  // avoid parent styles getting into this div
  // https://css-tricks.com/almanac/properties/a/all/
  avoidParentStyle: {
    all: 'initial',
  },
}))

const JBrowseLinearGenomeView = observer(
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
      <div className={classes.avoidParentStyle}>
        <ThemeProvider theme={theme}>
          <ScopedCssBaseline>
            <ViewContainer key={`view-${view.id}`} view={view}>
              <Suspense fallback={<div>Loading...</div>}>
                <ReactComponent model={view} session={session} />
              </Suspense>
            </ViewContainer>
            <ModalWidget session={session} />
          </ScopedCssBaseline>
        </ThemeProvider>
      </div>
    )
  },
)

export default JBrowseLinearGenomeView
