import { useState } from 'react'

import { JBrowseApp, createViewState } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

export default function SpreadsheetExample() {
  const [state] = useState(() =>
    createViewState({
      config: {
        ...volvoxConfig,
        defaultSession: {
          name: 'Volvox VCF spreadsheet',
          views: [
            {
              id: 'spreadsheet_view',
              type: 'SpreadsheetView',
              init: {
                assembly: 'volvox',
                uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.filtered.vcf.gz',
              },
            },
          ],
        },
      },
    }),
  )

  return <JBrowseApp viewState={state} />
}
