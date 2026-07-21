import { JBrowse } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [{ name: 'volvox', uri: `${base}/volvox.2bit` }]

// the SV inspector loads the VCF straight from `init.uri` — no track config
export default function SvInspectorExample() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={[]}
      views={[
        {
          type: 'SvInspectorView',
          init: {
            assembly: 'volvox',
            uri: `${base}/volvox.dup.vcf.gz`,
          },
        },
      ]}
    />
  )
}
