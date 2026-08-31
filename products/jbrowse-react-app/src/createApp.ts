import { createElement } from 'react'

import { observeSession } from '@jbrowse/product-core'
import { createRoot } from 'react-dom/client'

import JBrowseApp from './JBrowseApp/index.ts'
import { createViewStateFromProps } from './createViewStateFromProps.ts'
import { destroyViewState } from './destroyViewState.ts'

import type { ManagedView } from './JBrowse/index.ts'
import type { ViewModel } from './createModel.ts'
import type { CreateAppOptions } from './createViewStateFromProps.ts'
import type { SessionSnapshot } from './types.ts'

export type { CreateAppOptions, ManagedView }

export interface JBrowseAppController {
  /** the underlying MST app model */
  readonly viewState: ViewModel
  /**
   * open another view after launch, same shape as a `views` entry. Returns the
   * view's id — the one you gave, or the one generated for you, which is
   * otherwise unobtainable and is what `removeView` takes.
   */
  addView(view: ManagedView): string
  /** close a view opened at launch or by `addView`; unknown ids are ignored */
  removeView(id: string): void
  /**
   * Replace the whole session — a snapshot from {@link decodeSession}, or one
   * you stored. The counterpart of the `session` mount option, for the state
   * that arrives after mount: a URL the user pasted, a saved view they picked.
   * Pass nothing to return to the `views` the app launched with.
   */
  setSession(session?: SessionSnapshot): void
  /**
   * Unmount the app and tear the engine down — React root, RPC worker threads,
   * and the MST tree's autoruns. The controller is unusable afterwards.
   */
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
  const disposeObservers = observeSession(viewState, opts)
  const root = createRoot(el)
  root.render(createElement(JBrowseApp, { viewState }))

  return {
    get viewState() {
      return viewState
    },
    addView({ type, ...rest }) {
      return viewState.session.addView(type, rest).id
    },
    removeView(id) {
      const view = viewState.session.views.find(v => v.id === id)
      if (view) {
        viewState.session.removeView(view)
      }
    },
    setSession(session) {
      if (session) {
        viewState.setSession(session)
      } else {
        // back to the app's own starting state, which `views` defined
        viewState.setDefaultSession()
      }
    },
    destroy() {
      // observers first, then unmount: destroying the tree out from under a
      // mounted observer would have it re-render against dead nodes
      disposeObservers()
      root.unmount()
      destroyViewState(viewState)
    },
  }
}
