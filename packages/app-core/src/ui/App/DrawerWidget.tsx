import { Suspense, lazy, useState } from 'react'

import {
  ErrorBanner,
  LoadingEllipses,
  PluggableComponent,
} from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { getEnv } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import Drawer from './Drawer.tsx'
import DrawerHeader from './DrawerHeader.tsx'

import type { SessionWithFocusedViewAndDrawerWidgets } from '@jbrowse/core/util/types'

const ModalWidget = lazy(() => import('./ModalWidget.tsx'))

const DrawerWidget = observer(function DrawerWidget({
  session,
}: {
  session: SessionWithFocusedViewAndDrawerWidgets
}) {
  const { visibleWidget } = session
  const { pluginManager } = getEnv(session)

  const widgetType = visibleWidget
    ? pluginManager.getWidgetType(visibleWidget.type)
    : null
  if (visibleWidget && !widgetType) {
    throw new Error(`unknown widget type ${visibleWidget.type}`)
  }
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
          FallbackComponent={({ error }) => <ErrorBanner error={error} />}
        >
          {widgetType && visibleWidget ? (
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
                <PluggableComponent
                  pluginManager={pluginManager}
                  name="Core-replaceWidget"
                  component={widgetType.ReactComponent}
                  props={{
                    model: visibleWidget,
                    session,
                    toolbarHeight,
                  }}
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
