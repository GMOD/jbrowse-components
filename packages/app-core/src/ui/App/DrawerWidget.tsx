import React, { Suspense, useState } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { observer } from 'mobx-react'
import { getEnv } from '@jbrowse/core/util'
import LoadingEllipses from '@jbrowse/core/ui/LoadingEllipses'
import ErrorMessage from '@jbrowse/core/ui/ErrorMessage'
import { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

// locals
import Drawer from './Drawer'
import DrawerHeader from './DrawerHeader'

const DrawerWidget = observer(function ({
  session,
}: {
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const { visibleWidget } = session
  const { pluginManager } = getEnv(session)

  const DrawerComponent = visibleWidget
    ? (pluginManager.evaluateExtensionPoint(
        'Core-replaceWidget',
        pluginManager.getWidgetType(visibleWidget.type).ReactComponent,
        {
          session,
          model: visibleWidget,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as React.FC<any>)
    : null

  // we track the toolbar height because components that use virtualized
  // height want to be able to fill the contained, minus the toolbar height
  // (the position static/sticky is included in AutoSizer estimates)
  const [toolbarHeight, setToolbarHeight] = useState(0)

  return (
    <Drawer session={session}>
      <DrawerHeader session={session} setToolbarHeight={setToolbarHeight} />
      <Suspense fallback={<LoadingEllipses />}>
        <ErrorBoundary
          FallbackComponent={({ error }) => <ErrorMessage error={error} />}
        >
          {DrawerComponent ? (
            <>
              <DrawerComponent
                model={visibleWidget}
                session={session}
                toolbarHeight={toolbarHeight}
              />
              <div style={{ height: 300 }} />
            </>
          ) : null}
        </ErrorBoundary>
      </Suspense>
    </Drawer>
  )
})

export default DrawerWidget
