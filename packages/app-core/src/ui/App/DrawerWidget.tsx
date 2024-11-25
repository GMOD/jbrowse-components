import React, { Suspense, lazy, useState } from 'react'
import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'

import { getEnv } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

// locals
import Drawer from './Drawer'
import DrawerHeader from './DrawerHeader'
import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

const ModalWidget = lazy(() => import('./ModalWidget'))

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
        pluginManager.getWidgetType(visibleWidget.type)!.ReactComponent,
        {
          session,
          model: visibleWidget,
        },
      ) as React.FC<any>)
    : null

  // we track the toolbar height because components that use virtualized
  // height want to be able to fill the contained, minus the toolbar height
  // (the position static/sticky is included in AutoSizer estimates)
  const [toolbarHeight, setToolbarHeight] = useState(0)
  const [popoutDrawer, setPopoutDrawer] = useState(false)

  return (
    <Drawer session={session}>
      <DrawerHeader
        onPopoutDrawer={() => {
          setPopoutDrawer(true)
        }}
        session={session}
        setToolbarHeight={setToolbarHeight}
      />
      <Suspense fallback={<LoadingEllipses />}>
        <ErrorBoundary
          FallbackComponent={({ error }) => <ErrorMessage error={error} />}
        >
          {DrawerComponent ? (
            popoutDrawer ? (
              <>
                <div>Opened in dialog...</div>
                <ModalWidget
                  session={session}
                  onClose={() => {
                    setPopoutDrawer(false)
                  }}
                />
              </>
            ) : (
              <>
                <DrawerComponent
                  model={visibleWidget}
                  session={session}
                  toolbarHeight={toolbarHeight}
                />
                <div style={{ height: 300 }} />
              </>
            )
          ) : null}
        </ErrorBoundary>
      </Suspense>
    </Drawer>
  )
})

export default DrawerWidget
