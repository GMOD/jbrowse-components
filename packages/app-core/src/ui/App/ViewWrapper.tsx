import { Suspense } from 'react'

// ui elements
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'
import { getEnv } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

const ViewWrapper = observer(function ({
  view,
  session,
}: {
  view: AbstractViewModel
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const { pluginManager } = getEnv(session)
  const viewType = pluginManager.getViewType(view.type)
  if (!viewType) {
    throw new Error(`unknown view type ${view.type}`)
  }
  const { ReactComponent } = viewType
  if (view.minimized) {
    return null
  }

  return (
    <Suspense fallback={<LoadingEllipses variant="h6" />}>
      <ReactComponent model={view} session={session} />
    </Suspense>
  )
})

export default ViewWrapper
