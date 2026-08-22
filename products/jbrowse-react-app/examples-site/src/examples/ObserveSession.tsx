import { JBrowseApp, useCreateViewState } from '@jbrowse/react-app2'
import { observer } from 'mobx-react'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const config = {
  assemblies: [{ name: 'volvox', uri: `${base}/volvox.2bit` }],
  tracks: [
    {
      type: 'AlignmentsTrack',
      trackId: 'volvox_cram',
      name: 'volvox-sorted.cram',
      assemblyNames: ['volvox'],
      adapter: { type: 'CramAdapter', uri: `${base}/volvox-sorted.cram` },
    },
  ],
  defaultSession: {
    name: 'observe',
    views: [
      {
        id: 'view-0',
        type: 'LinearGenomeView',
        init: {
          assembly: 'volvox',
          loc: 'ctgA:1..50000',
          tracks: ['volvox_cram'],
        },
      },
    ],
  },
}

// The session is a MobX-state-tree node, so anything outside the app can wrap in
// `observer` and re-render when the fields it reads change. No subscription, no
// event wiring: the getters are the API. Add a view or pan one and this updates.
const SessionSummary = observer(function SessionSummary({
  viewState,
}: {
  viewState: NonNullable<ReturnType<typeof useCreateViewState>>
}) {
  const { views } = viewState.session
  return (
    <div style={{ padding: 8, fontFamily: 'monospace', fontSize: 12 }}>
      <div>{views.length} view(s) open</div>
      <ul style={{ margin: 0 }}>
        {views.map(view => (
          <li key={view.id}>
            {view.type} — {view.coarseVisibleLocStrings || 'no region'}
          </li>
        ))}
      </ul>
    </div>
  )
})

export default function ObserveSession() {
  // `useCreateViewState`, not `useState(() => createViewState(…))`: React
  // double-invokes a state initializer under StrictMode and throws the second
  // result away, which for an engine is a whole orphaned worker pool per mount.
  // undefined for the frame in which the engine is still being built — the
  // view and display types the config's session names load first
  const viewState = useCreateViewState({ config })

  return viewState ? (
    <div>
      <SessionSummary viewState={viewState} />
      <JBrowseApp viewState={viewState} />
    </div>
  ) : null
}
