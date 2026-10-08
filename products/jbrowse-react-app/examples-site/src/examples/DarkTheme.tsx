import { JBrowse } from '@jbrowse/react-app2'

const base = 'https://jbrowse.org/code/jb2/main/test_data/volvox'

const assemblies = [
  { name: 'volvox', uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit' },
]

const tracks = [
  {
    trackId: 'volvox_cram',
    name: 'volvox-sorted.cram',
    uri: `${base}/volvox-sorted.cram`,
  },
]

export default function DarkTheme() {
  return (
    <JBrowse
      assemblies={assemblies}
      tracks={tracks}
      configuration={{
        theme: {
          palette: {
            mode: 'dark',
            primary: { main: '#333' },
            secondary: { main: '#444' },
          },
        },
      }}
      views={[
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1..50000',
          tracks: ['volvox_cram'],
        },
      ]}
    />
  )
}
