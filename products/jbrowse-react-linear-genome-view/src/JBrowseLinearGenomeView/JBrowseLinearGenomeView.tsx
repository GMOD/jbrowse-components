import React, { Suspense } from 'react'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { makeStyles } from '@material-ui/core'
import { SessionModel } from '../createModel/createSessionModel'
import ModalWidget from './ModalWidget'
import ViewContainer from './ViewContainer'

const useStyles = makeStyles(() => ({
  avoidParentStyle: {
    all: 'initial',
  },
}))
export default observer(
  ({ viewState }: { viewState: { session: SessionModel } }) => {
    const classes = useStyles()
    const { session } = viewState
    const { view } = session
    const viewType = getEnv(session).pluginManager.getViewType(view.type)
    if (!viewType) {
      throw new Error(`unknown view type ${view.type}`)
    }
    const { ReactComponent } = viewType

    return (
      // avoid parent styles getting into this div
      // https://css-tricks.com/almanac/properties/a/all/
      <div className={classes.avoidParentStyle}>
        <ViewContainer key={`view-${view.id}`} view={view}>
          <Suspense fallback={<div>Wow</div>}>
            <ReactComponent model={view} session={session} />
          </Suspense>
        </ViewContainer>
        <ModalWidget session={session} />
      </div>
    )
  },
)
