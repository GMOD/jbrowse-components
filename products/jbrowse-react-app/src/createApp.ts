import { createElement } from 'react'

import { createRoot } from 'react-dom/client'

import JBrowseApp from './JBrowseApp/index.ts'
import { createViewStateFromProps } from './createViewStateFromProps.ts'

import type { ManagedView } from './JBrowse/index.ts'
import type { ViewModel } from './createModel.ts'
import type { CreateAppOptions } from './createViewStateFromProps.ts'

export type { CreateAppOptions, ManagedView }

export interface JBrowseAppController {
  /** the underlying MST app model */
  readonly viewState: ViewModel
  /** open another view after launch, same `{ type, init }` shape as `views` */
  addView(view: ManagedView): void
  destroy(): void
}

/**
 * Mount the full JBrowse 2 app imperatively into a DOM element and drive it
 * through a small controller — the same engine `<JBrowse>` renders, for hosts
 * that don't write JSX (anywidget, htmlwidgets, vanilla JS, ...). React and
 * react-dom are still required: this saves you a React root, not React.
 *
 * The engine is built here rather than by rendering `<JBrowse ref>` because a
 * root's render is not committed synchronously, so a ref would not be populated
 * in time to hand back a controller.
 */
export function createApp(
  el: HTMLElement,
  opts: CreateAppOptions,
): JBrowseAppController {
  const viewState = createViewStateFromProps(opts)
  const root = createRoot(el)
  root.render(createElement(JBrowseApp, { viewState }))

  return {
    get viewState() {
      return viewState
    },
    addView(view) {
      viewState.session.addView(view.type, { id: view.id, init: view.init })
    },
    destroy() {
      root.unmount()
    },
  }
}
