import { Suspense, useState } from 'react'

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

import type { SessionWithDrawerWidgets } from '@jbrowse/core/util'

const DrawerWidget = observer(function DrawerWidget({
  session,
}: {
  session: SessionWithDrawerWidgets
}) {
  const { visibleWidget } = session
  const { pluginManager } = getEnv(session)
  const [toolbarHeight, setToolbarHeight] = useState(0)

  return (
    <Drawer session={session}>
      <DrawerHeader session={session} setToolbarHeight={setToolbarHeight} />
      <Suspense fallback={<LoadingEllipses />}>
        <ErrorBoundary
          FallbackComponent={({ error }) => <ErrorBanner error={error} />}
        >
          {visibleWidget ? (
            <PluggableComponent
              pluginManager={pluginManager}
              name="Core-replaceWidget"
              component={
                pluginManager.getWidgetType(visibleWidget.type).ReactComponent
              }
              props={{
                model: visibleWidget,
                session,
                toolbarHeight,
              }}
            />
          ) : null}
        </ErrorBoundary>
      </Suspense>
    </Drawer>
  )
})

export default DrawerWidget
