import { Suspense } from 'react'

import {
  ErrorBanner,
  LoadingEllipses,
  PluggableComponent,
} from '@jbrowse/core/ui'
import { ErrorBoundary } from '@jbrowse/core/ui/ErrorBoundary'
import { getEnv } from '@jbrowse/core/util'
import { observer } from 'mobx-react'

import type { SessionWithWidgets, Widget } from '@jbrowse/core/util'

/**
 * Renders one widget: resolve its React component, run it through the
 * `Core-replaceWidget` fold, and contain both its lazy chunk and its errors.
 *
 * Only the chrome around a widget differs between surfaces — the drawer's
 * resizable paper and header, the modal's dialog — so this is the part all of
 * them share, spelled once. The error boundary in particular was previously
 * only on the drawer path: popping the same widget out to a modal turned a
 * widget that throws during render from a banner in the widget's own area into
 * an unhandled throw that took the app down with it.
 */
const WidgetBody = observer(function WidgetBody({
  session,
  widget,
  toolbarHeight = 0,
}: {
  session: SessionWithWidgets
  widget: Widget
  // room the surface's own header occupies, which widgets that size a
  // virtualized list need to subtract from the height they are given
  toolbarHeight?: number
}) {
  const { pluginManager } = getEnv(session)
  return (
    <Suspense fallback={<LoadingEllipses />}>
      <ErrorBoundary
        FallbackComponent={({ error }) => <ErrorBanner error={error} />}
      >
        <PluggableComponent
          pluginManager={pluginManager}
          name="Core-replaceWidget"
          component={pluginManager.getWidgetType(widget.type).ReactComponent}
          props={{ model: widget, session, toolbarHeight }}
        />
      </ErrorBoundary>
    </Suspense>
  )
})

export default WidgetBody
