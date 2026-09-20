import { useEffect, useState } from 'react'

import {
  JBrowseLinearGenomeView,
  useCreateViewState,
} from '@jbrowse/react-linear-genome-view2'

import type { LocalFileInput } from '@jbrowse/react-linear-genome-view2'

const assembly = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'local_bam',
    name: 'volvox-sorted.bam (in memory)',
    assemblyNames: ['volvox'],
    adapter: { type: 'BamAdapter', uri: 'volvox-sorted.bam' },
  },
]

function LocalFileView({ localFiles }: { localFiles: LocalFileInput }) {
  const state = useCreateViewState({
    assembly,
    tracks,
    localFiles,
    view: { loc: 'ctgA:1..20000', tracks: ['local_bam'] },
  })
  return state ? <JBrowseLinearGenomeView viewState={state} /> : null
}

export default function WithLocalFiles() {
  const [files, setFiles] = useState<LocalFileInput>()
  const [error, setError] = useState<unknown>()

  useEffect(() => {
    const mount = { unmounted: false }
    void (async () => {
      try {
        const [bam, bai] = await Promise.all(
          ['volvox-sorted.bam', 'volvox-sorted.bam.bai'].map(async name => {
            const res = await fetch(
              `https://jbrowse.org/code/jb2/main/test_data/volvox/${name}`,
            )
            if (!res.ok) {
              throw new Error(`HTTP ${res.status} fetching ${name}`)
            }
            return new Uint8Array(await res.arrayBuffer())
          }),
        )
        if (!mount.unmounted) {
          setFiles({
            'volvox-sorted.bam': bam!,
            'volvox-sorted.bam.bai': bai!,
          })
        }
      } catch (e) {
        console.error(e)
        setError(e)
      }
    })()
    return () => {
      mount.unmounted = true
    }
  }, [])

  const bytes = files?.['volvox-sorted.bam'] as Uint8Array | undefined

  return (
    <div>
      <div style={{ padding: 8, fontSize: 13, background: '#8881' }}>
        {error
          ? `could not read the file: ${error}`
          : bytes
            ? `${bytes.length.toLocaleString()} bytes of BAM held in this page's memory — the pileup below is read out of it by byte range, so panning touches only the bytes for the region on screen`
            : 'reading the file into memory…'}
      </div>
      {files ? (
        <LocalFileView key={Object.keys(files).join(',')} localFiles={files} />
      ) : null}
    </div>
  )
}
