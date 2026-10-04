import { CircularGenomeView } from '@jbrowse/react-circular-genome-view2'

export default function WithDarkTheme() {
  return (
    <CircularGenomeView
      assembly={{
        name: 'volvox',
        uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
      }}
      tracks={[
        {
          trackId: 'volvox_sv',
          name: 'Volvox duplications',
          uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.dup.vcf.gz',
        },
      ]}
      view={{ tracks: ['volvox_sv'] }}
      configuration={{
        theme: {
          palette: {
            mode: 'dark',
            primary: { main: '#333' },
            secondary: { main: '#444' },
          },
        },
      }}
    />
  )
}
