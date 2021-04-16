import React, { Suspense } from 'react'
import { observer } from 'mobx-react'
import { getEnv } from 'mobx-state-tree'
import { makeStyles } from '@material-ui/core'
import { SessionModel } from '../createModel/createSessionModel'
import ModalWidget from './ModalWidget'
import ViewContainer from './ViewContainer'

const useStyles = makeStyles(() => ({
  // avoid parent styles getting into this div
  // https://css-tricks.com/almanac/properties/a/all/
  avoidParentStyle: {
    all: 'initial',
  },
}))

const JBrowseLinearGenomeView = observer(
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
      <div className={classes.avoidParentStyle}>
        <ViewContainer key={`view-${view.id}`} view={view}>
          <Suspense fallback={<div>Loading...</div>}>
            <ReactComponent model={view} session={session} />
          </Suspense>
        </ViewContainer>
        <ModalWidget session={session} />
      </div>
    )
  },
)

export default JBrowseLinearGenomeView
