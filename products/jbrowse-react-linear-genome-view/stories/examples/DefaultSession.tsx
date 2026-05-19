// in your code:
// import { useCreateViewState, JBrowseLinearGenomeView } from '@jbrowse/react-linear-genome-view2'
import { getVolvoxConfig } from './util.ts'
import { JBrowseLinearGenomeView, useCreateViewState } from '../../src/index.ts'

export const DefaultSession = () => {
  const { assembly, tracks } = getVolvoxConfig()
  // use the `init` shorthand to open a location and tracks on startup
  const state = useCreateViewState({
    assembly,
    tracks,
    defaultSession: {
      name: 'My session',
      view: {
        type: 'LinearGenomeView',
        init: {
          loc: 'ctgA:1105..1221',
          assembly: 'volvox',
          tracks: ['volvox-long-reads-sv-bam'],
        },
      },
    },
  })

  return (
    <div>
      <JBrowseLinearGenomeView viewState={state} />
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-linear-genome-view/stories/examples/DefaultSession.tsx">
        Source code
      </a>
    </div>
  )
}
