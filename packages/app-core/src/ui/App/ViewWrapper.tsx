import { Suspense } from 'react'

// ui elements
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'
import { getEnv } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type {
  AbstractViewModel,
  SessionWithFocusedViewAndDrawerWidgets,
} from '@jbrowse/core/util'

const ViewWrapper = observer(function ViewWrapper({
  view,
  session,
}: {
  view: AbstractViewModel
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const { pluginManager } = getEnv(session)
  const { ReactComponent } = pluginManager.getViewType(view.type)
  return view.minimized ? (
    <Suspense fallback={<LoadingEllipses variant="h6" />}>
      <ReactComponent model={view} session={session} />
    </Suspense>
  ) : null
})

export default ViewWrapper
