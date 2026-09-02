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

// The track refers to the file by the name it was registered under, exactly as
// it would a URL — so the `.bam` extension still picks the adapter, and the
// adapter still derives its `.bai` sibling by name. Nothing here knows the file
// is local.
const tracks = [
  {
    type: 'AlignmentsTrack',
    trackId: 'local_bam',
    name: 'volvox-sorted.bam (in memory)',
    assemblyNames: ['volvox'],
    adapter: { type: 'BamAdapter', uri: 'volvox-sorted.bam' },
  },
]

// `localFiles` is read once, when the engine is built, like every other option.
// So a new set of files is a new engine, and this component is remounted on a
// `key` below to get one. The engine it leaves behind is useCreateViewState's
// to destroy — React owns it, and unmounting takes the RPC worker threads and
// the autoruns with it.
function LocalFileView({ localFiles }: { localFiles: LocalFileInput }) {
  const state = useCreateViewState({
    assembly,
    tracks,
    localFiles,
    init: { loc: 'ctgA:1..20000', tracks: ['local_bam'] },
  })
  return state ? <JBrowseLinearGenomeView viewState={state} /> : null
}

export default function WithLocalFiles() {
  const [files, setFiles] = useState<LocalFileInput>()
  const [error, setError] = useState<unknown>()

  // Standing in for whatever puts bytes in your host's memory. In a Jupyter
  // kernel that is `path.read_bytes()` and anywidget's binary channel; in an R
  // session, `readBin`. A web page has no such thing, so this demo fetches —
  // which is the one part of it you would not write.
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
          // the whole API: a name, and the bytes behind it. Registering the
          // index under its conventional sibling name is what keeps the file
          // indexed — without it the adapter has no index to seek with
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
        // keyed on the names, so a different set of files rebuilds the engine
        <LocalFileView key={Object.keys(files).join(',')} localFiles={files} />
      ) : null}
    </div>
  )
}
