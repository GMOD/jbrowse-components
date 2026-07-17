import createViewState from './createViewState.ts'

import type { JBrowseProps, ManagedView } from './JBrowse/index.ts'

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

export interface AppSessionSnapshot {
  name: string
  views?: { id: string; type: string; init?: ManagedView['init'] }[]
  // the app's session snapshot type carries an index signature (SnapshotIn of
  // the MST session model); mirror it so this is assignable to createViewState
  [key: string]: unknown
}

// Turn the declarative `views` list into a session snapshot, defaulting each
// view's id. Pure (no engine/DOM) so the mapping is unit-testable.
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

// Build the engine from the declarative props. Shared by the two entry points
// that accept them — <JBrowse> and createApp — which otherwise construct this
// identically and drift apart.
export function createViewStateFromProps(opts: CreateAppOptions) {
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
  return createViewState({
    config: {
      assemblies,
      tracks,
      internetAccounts,
      aggregateTextSearchAdapters,
      configuration,
      // `views` is the single initial-state mechanism; with none given, the
      // session opens empty but still honors `sessionName`
      defaultSession: viewsToSession(sessionName, views),
    },
    plugins,
    onChange,
    makeWorkerInstance,
  })
}
