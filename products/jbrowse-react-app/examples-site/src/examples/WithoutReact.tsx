import { createApp } from '@jbrowse/react-app2'

export default function WithoutReact() {
  return (
    <div
      ref={el => {
        if (el) {
          const pending = createApp(el, {
            assemblies: [
              {
                name: 'volvox',
                uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
              },
            ],
            tracks: [
              {
                trackId: 'volvox_genes',
                uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
              },
            ],
            views: [
              {
                type: 'LinearGenomeView',
                assembly: 'volvox',
                loc: 'ctgA:1..50000',
                tracks: ['volvox_genes'],
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
