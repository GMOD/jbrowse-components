// replace with this in your code:
// import {createViewState,JBrowseApp} from '@jbrowse/react-app2'
import { addRelativeUris } from './util.ts'
import config from '../../public/test_data/volvox/config.json' with { type: 'json' }
import { JBrowseApp, createViewState } from '../../src/index.ts'

const configPath = 'test_data/volvox/config.json'
addRelativeUris(config, new URL(configPath, window.location.href).href)

export const SyntenyExample = () => {
  const state = createViewState({
    config: {
      ...config,
      defaultSession: {
        name: 'Volvox vs Volvox Del synteny',
        views: [
          {
            id: 'synteny_view',
            type: 'LinearSyntenyView',
            init: {
              views: [{ assembly: 'volvox' }, { assembly: 'volvox_del' }],
              tracks: ['volvox_del.paf'],
            },
          },
        ],
      },
    },
  })

  return (
    <div>
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/stories/examples/SyntenyExample.tsx">
        Source code
      </a>
      <JBrowseApp viewState={state} />
    </div>
  )
}
