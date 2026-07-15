import { JBrowse } from '@jbrowse/react-app2'

import { volvoxConfig } from '../volvoxConfig.ts'

export default function SpreadsheetExample() {
  return (
    <JBrowse
      assemblies={volvoxConfig.assemblies}
      tracks={volvoxConfig.tracks}
      views={[
        {
          type: 'SpreadsheetView',
          init: {
            assembly: 'volvox',
            uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.filtered.vcf.gz',
          },
        },
      ]}
    />
  )
}
