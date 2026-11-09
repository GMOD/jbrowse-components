import { useState } from 'react'

import {
  JBrowseLinearGenomeView,
  createViewStateAsync,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

async function readBytes(name: string) {
  const res = await fetch(
    `https://jbrowse.org/code/jb2/main/test_data/volvox/${name}`,
  )
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${name}`)
  }
  return new Uint8Array(await res.arrayBuffer())
}

async function build(report: (bytes: number) => void) {
  const [bam, bai] = await Promise.all([
    readBytes('volvox-sorted.bam'),
    readBytes('volvox-sorted.bam.bai'),
  ])
  report(bam.length)
  return createViewStateAsync({
    assembly: {
      name: 'volvox',
      uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
    },
    tracks: [
      {
        trackId: 'local_bam',
        name: 'volvox-sorted.bam (in memory)',
        uri: 'volvox-sorted.bam',
      },
    ],
    localFiles: { 'volvox-sorted.bam': bam, 'volvox-sorted.bam.bai': bai },
    view: { loc: 'ctgA:1..20000', tracks: ['local_bam'] },
  })
}

export default function LocalFiles() {
  const [bytes, setBytes] = useState<number>()
  const state = useCreateViewState(() => build(setBytes))
  return (
    <div>
      <div style={{ padding: 8, fontSize: 13, background: '#8881' }}>
        {bytes === undefined
          ? 'reading the file into memory…'
          : `${bytes.toLocaleString()} bytes of BAM held in this page's memory — the pileup below is read out of it by byte range, so panning touches only the bytes for the region on screen`}
      </div>
      {state ? <JBrowseLinearGenomeView viewState={state} /> : null}
    </div>
  )
}
