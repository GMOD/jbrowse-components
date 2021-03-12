import { observer } from 'mobx-react'
import { Instance, getEnv } from 'mobx-state-tree'
import React from 'react'
import createSessionModel from '../createModel/createSessionModel'
import ModalWidget from './ModalWidget'
import ViewContainer from './ViewContainer'

type Session = Instance<ReturnType<typeof createSessionModel>>
function JBrowseLinearGenomeView({
  viewState,
}: {
  viewState: { session: Session }
}) {
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
    <div style={{ all: 'initial' }}>
      <ViewContainer key={`view-${view.id}`} view={view}>
        <ReactComponent model={view} session={session} />
      </ViewContainer>
      <ModalWidget session={session} />
    </div>
  )
}

export default observer(JBrowseLinearGenomeView)
