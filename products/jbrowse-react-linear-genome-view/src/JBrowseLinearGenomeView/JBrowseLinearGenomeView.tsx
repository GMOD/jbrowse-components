import { observer } from 'mobx-react'
import { Instance } from 'mobx-state-tree'
import React from 'react'
import createSessionModel from '../createModel/createSessionModel'
import ModalWidget from './ModalWidget'
import ViewContainer from './ViewContainer'
import './App.css'

type Session = Instance<ReturnType<typeof createSessionModel>>
function JBrowseLinearGenomeView({
  viewState,
}: {
  viewState: { session: Session }
}) {
  const { session } = viewState
  const { view, pluginManager } = session
  const viewType = pluginManager.getViewType(view.type)
  if (!viewType) {
    throw new Error(`unknown view type ${view.type}`)
  }
  const { ReactComponent } = viewType

  return (
    <div className="yui3-cssreset">
      <ViewContainer key={`view-${view.id}`} view={view}>
        <ReactComponent model={view} session={session} />
      </ViewContainer>
      <ModalWidget session={session} />
    </div>
  )
}

export default observer(JBrowseLinearGenomeView)
