import { createApp } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [
  { name: 'volvox', uri: `${base}/volvox.2bit` },
  { name: 'volvox_del', uri: `${base}/volvox_del.fa` },
]

const tracks = [
  {
    type: 'SyntenyTrack',
    trackId: 'volvox_del.paf',
    name: 'volvox_del.paf',
    assemblyNames: ['volvox', 'volvox_del'],
    category: ['Synteny'],
    adapter: {
      type: 'PAFAdapter',
      uri: `${base}/volvox_del.paf`,
      targetAssembly: 'volvox',
      queryAssembly: 'volvox_del',
    },
  },
]

// Every other example on this site uses the <JBrowse> React component. This one
// uses `createApp` instead — the framework-agnostic imperative mount that
// non-React hosts (anywidget, R htmlwidgets, vanilla JS) wrap. It takes the same
// declarative `views` list, so a synteny view is one `{ type, init }` entry. A
// cleanup-returning ref bridges the imperative mount into React: it builds the
// app when the div attaches and disposes it when the div unmounts.
export default function CreateAppSynteny() {
  return (
    <div
      ref={el => {
        if (el) {
          // the catch is attached HERE, not in the cleanup below: a `void
          // pending.then(...)` there would leave a build failure unhandled on a
          // page that never unmounts, and a ref callback has nowhere to throw
          const pending = createApp(el, {
            assemblies,
            tracks,
            views: [
              {
                type: 'LinearSyntenyView',
                views: [{ assembly: 'volvox' }, { assembly: 'volvox_del' }],
                tracks: ['volvox_del.paf'],
              },
            ],
          }).catch((e: unknown) => {
            console.error(e)
            return undefined
          })
          return () => {
            // `createApp` resolves the view and display state models its `views`
            // name before it mounts anything, so the controller can still be on
            // its way when this fires — disposing on arrival covers both the
            // ordinary unmount and the one that beat the mount to it
            void pending.then(controller => {
              controller?.destroy()
            })
          }
        }
      }}
    />
  )
}
