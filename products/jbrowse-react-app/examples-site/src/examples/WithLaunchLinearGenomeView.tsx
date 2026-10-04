import { useRef } from 'react'

import { JBrowse } from '@jbrowse/react-app2'

import type { ViewModel } from '@jbrowse/react-app2'

const assemblies = [
  {
    name: 'GRCh38',
    aliases: ['hg38'],
    uri: 'https://jbrowse.org/genomes/GRCh38/fasta/hg38.prefix.fa.gz',
    refNameAliases: {
      uri: 'https://jbrowse.org/genomes/GRCh38/hg38_aliases.txt',
    },
    geneticCodes: { chrM: 2 },
  },
]

const tracks = [
  {
    trackId: 'hg38.100way.phyloP100way',
    name: 'hg38.100way.phyloP100way',
    uri: 'https://hgdownload.soe.ucsc.edu/goldenpath/hg38/phyloP100way/hg38.phyloP100way.bw',
    category: ['Conservation'],
    assemblyNames: ['hg38'],
  },
]

export default function WithLaunchLinearGenomeView() {
  const ref = useRef<ViewModel>(null)

  function openView() {
    const session = ref.current?.session
    session
      ?.launchView('LinearGenomeView', {
        assembly: 'hg38',
        loc: 'chr10:1-100000',
        tracks: ['hg38.100way.phyloP100way'],
      })
      .catch((e: unknown) => {
        session.notifyError(`${e}`, e)
      })
  }

  return (
    <div>
      <button onClick={openView}>Open a linear genome view</button>
      <JBrowse ref={ref} assemblies={assemblies} tracks={tracks} />
    </div>
  )
}
