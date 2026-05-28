// replace with this in your code:
// import { createViewState, JBrowseApp } from '@jbrowse/react-app2'
import { useState } from 'react'

import { addRelativeUris } from './util.ts'
import config from '../../public/test_data/volvox/config.json' with { type: 'json' }
import { JBrowseApp, createViewState } from '../../src/index.ts'

const configPath = 'test_data/volvox/config.json'
addRelativeUris(config, new URL(configPath, window.location.href).href)

export const SvInspectorExample = () => {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...config,
        defaultSession: {
          name: 'Volvox SV inspector',
          views: [
            {
              id: 'sv_inspector_view',
              type: 'SvInspectorView',
              init: {
                assembly: 'volvox',
                uri: 'test_data/volvox/volvox.dup.vcf.gz',
              },
            },
          ],
        },
      },
    }),
  )

  return (
    <>
      <a href="https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-react-app/stories/examples/SvInspectorExample.tsx">
        Source code
      </a>
      <JBrowseApp viewState={state} />
    </>
  )
}
