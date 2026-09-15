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

export default function CreateAppSynteny() {
  return (
    <div
      ref={el => {
        if (el) {
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
            void pending.then(controller => {
              controller?.destroy()
            })
          }
        }
      }}
    />
  )
}
