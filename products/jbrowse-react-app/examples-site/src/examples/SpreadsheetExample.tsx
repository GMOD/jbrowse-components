import { JBrowse } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [{ name: 'volvox', uri: `${base}/volvox.2bit` }]

// the spreadsheet view loads the file straight from `init.uri` — no track config
export default function SpreadsheetExample() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={[]}
      views={[
        {
          type: 'SpreadsheetView',
          init: {
            assembly: 'volvox',
            uri: `${base}/volvox.filtered.vcf.gz`,
          },
        },
      ]}
    />
  )
}
