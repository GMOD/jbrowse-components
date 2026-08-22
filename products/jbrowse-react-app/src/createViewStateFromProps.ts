import createViewState, { createViewStateAsync } from './createViewState.ts'

import type { JBrowseProps, ManagedView } from './JBrowse/index.ts'
import type { SessionObservers, SessionSnapshot } from './types.ts'

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
// `headerButtons` is dropped along with `ref`: both are React values, and this
// is the shape a host that doesn't write JSX passes in. The read-backs are added
// rather than inherited for the same reason in reverse — a React host observes
// the engine it already holds a ref to; these exist for a host whose state lives
// off the page, and only createApp can reach one.
export interface CreateAppOptions
  extends Omit<JBrowseProps, 'ref' | 'headerButtons'>, SessionObservers {}

// The `views`-derived session, narrowed from the open SessionSnapshot shape so
// viewsToSession's mapping is checked. Assignable to SessionSnapshot (whose
// index signature it inherits), so it drops straight into createViewState.
export interface AppSessionSnapshot extends SessionSnapshot {
  views?: { id: string; type: string; init?: ManagedView['init'] }[]
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
  return createViewState(viewStateOptionsFromProps(opts))
}

/**
 * `createViewStateFromProps` for a config or session that may name lazily
 * loaded view types — see `createViewStateAsync`.
 */
export function createViewStateFromPropsAsync(opts: CreateAppOptions) {
  return createViewStateAsync(viewStateOptionsFromProps(opts))
}

function viewStateOptionsFromProps(opts: CreateAppOptions) {
  const {
    assemblies,
    tracks,
    connections,
    internetAccounts,
    aggregateTextSearchAdapters,
    configuration,
    plugins,
    makeWorkerInstance,
    onPluginsUpdated,
    views,
    session,
    sessionName = 'session',
    localFiles,
  } = opts
  return {
    config: {
      assemblies,
      tracks,
      connections,
      internetAccounts,
      aggregateTextSearchAdapters,
      configuration,
      // `views` describes the app's own starting state, so it stays the
      // defaultSession even when a restored `session` opens instead — File →
      // New session then returns here rather than to the restored one. With no
      // views given, the session opens empty but still honors `sessionName`.
      defaultSession: viewsToSession(sessionName, views),
    },
    session,
    plugins,
    onPluginsUpdated,
    makeWorkerInstance,
    // forwarded rather than resolved here: the substitution needs the plugin
    // manager (to expand a `{ type, uri }` adapter into the location keys it
    // then rewrites), and that does not exist until createViewState builds it
    localFiles,
  }
}
