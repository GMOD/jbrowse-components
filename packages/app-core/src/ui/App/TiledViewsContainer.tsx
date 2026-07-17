import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useTheme } from '@mui/material'
import { DockviewReact } from 'dockview-react'
import { observer } from 'mobx-react'

import { DockviewContext } from './DockviewContext.tsx'
import DockviewLeftHeaderActions from './DockviewLeftHeaderActions.tsx'
import DockviewRightHeaderActions from './DockviewRightHeaderActions.tsx'
import JBrowseViewPanel from './JBrowseViewPanel.tsx'
import JBrowseViewTab from './JBrowseViewTab.tsx'
import { useDockviewController } from './useDockviewController.ts'

import type { DockviewSessionType } from './types.ts'
import type { SessionWithDockviewLayout } from '../../DockviewLayout/index.ts'

const useStyles = makeStyles()(() => ({
  container: {
    height: '100%',
    width: '100%',
    gridRow: 'components',
  },
}))

interface Props {
  session: DockviewSessionType & SessionWithDockviewLayout
}

const components = {
  jbrowseView: JBrowseViewPanel,
}

const tabComponents = {
  jbrowseTab: JBrowseViewTab,
}

const TiledViewsContainer = observer(function TiledViewsContainer({
  session,
}: Props) {
  const { classes } = useStyles()
  const theme = useTheme()
  const { contextValue, onReady } = useDockviewController(session)

  const themeClass =
    theme.palette.mode === 'dark'
      ? 'dockview-theme-dark'
      : 'dockview-theme-light'

  return (
    <DockviewContext value={contextValue}>
      <div className={`${classes.container} ${themeClass}`}>
        <DockviewReact
          components={components}
          tabComponents={tabComponents}
          leftHeaderActionsComponent={DockviewLeftHeaderActions}
          rightHeaderActionsComponent={DockviewRightHeaderActions}
          onReady={onReady}
        />
      </div>
    </DockviewContext>
  )
})

export default TiledViewsContainer
