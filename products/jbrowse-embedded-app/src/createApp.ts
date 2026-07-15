import { createElement } from 'react'

import { JBrowseApp, createViewState } from '@jbrowse/react-app2'
import { createRoot } from 'react-dom/client'

import type { JBrowseProps, ManagedView, ViewModel } from '@jbrowse/react-app2'

export type { ManagedView }

/**
 * A declarative description of the app to mount. This is the framework-agnostic
 * twin of the `<JBrowse>` React component's props: `views` lists the views to
 * open, each carrying its own view-type `init` blob — the same shape a
 * `config.json`'s `defaultSession.views` uses, so a single vocabulary describes
 * a linear genome view, a synteny view, a dotplot, and so on:
 *
 * ```js
 * createApp(el, {
 *   assemblies: [hg38, mm39],
 *   tracks: [{ trackId: 'hg38_mm39.paf', ...paf }],
 *   views: [
 *     {
 *       type: 'LinearSyntenyView',
 *       init: {
 *         views: [{ assembly: 'hg38' }, { assembly: 'mm39' }],
 *         tracks: ['hg38_mm39.paf'],
 *       },
 *     },
 *   ],
 * })
 * ```
 */
export type CreateAppOptions = Omit<JBrowseProps, 'ref'>

export interface JBrowseAppController {
  /** the underlying MST app model */
  readonly viewState: ViewModel
  /** open another view after launch, same `{ type, init }` shape as `views` */
  addView(view: ManagedView): void
  destroy(): void
}

export interface AppSessionSnapshot {
  name: string
  views?: { id: string; type: string; init?: ManagedView['init'] }[]
  // the app's session snapshot type carries an index signature (SnapshotIn of
  // the MST session model); mirror it so this is assignable to createViewState
  [key: string]: unknown
}

// Turn the declarative `views` list into a session snapshot, defaulting each
// view's id. Pure (no engine/DOM) so the mapping is unit-testable and shared
// with the `<JBrowse>` component's identical inline version.
export function viewsToSession(
  sessionName: string,
  views: ManagedView[] | undefined,
): AppSessionSnapshot {
  return {
    name: sessionName,
    ...(views?.length
      ? {
          views: views.map((view, i) => ({
            id: view.id ?? `view-${i}`,
            type: view.type,
            init: view.init,
          })),
        }
      : {}),
  }
}

/**
 * Mount the full JBrowse 2 app imperatively into a DOM element and drive it
 * through a small controller. This is the multi-view counterpart to
 * `createLinearGenomeView`: the same framework-agnostic primitive every non-React
 * host (anywidget, htmlwidgets, vanilla JS, ...) wraps, but backed by the full
 * app engine so synteny, dotplot, circular, and breakpoint-split views are all
 * reachable from one declarative `views` list.
 */
export function createApp(
  el: HTMLElement,
  opts: CreateAppOptions,
): JBrowseAppController {
  const {
    assemblies,
    tracks,
    internetAccounts,
    aggregateTextSearchAdapters,
    configuration,
    plugins,
    makeWorkerInstance,
    onChange,
    views,
    sessionName = 'session',
  } = opts

  const viewState = createViewState({
    config: {
      assemblies,
      tracks,
      internetAccounts,
      aggregateTextSearchAdapters,
      configuration,
      defaultSession: viewsToSession(sessionName, views),
    },
    plugins,
    onChange,
    makeWorkerInstance,
  })

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
