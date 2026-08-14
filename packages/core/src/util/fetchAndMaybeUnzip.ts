import { downloadStatus, updateStatus } from './progress.ts'
import { withStopTokenSignal } from './stopToken.ts'

import type { BaseOptions } from '../data_adapters/BaseAdapter/index.ts'
import type { GenericFilehandle } from 'generic-filehandle2'

export function isGzip(buf: Uint8Array) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

export async function fetchAndMaybeUnzip(
  loc: GenericFilehandle,
  opts: BaseOptions = {},
  // what is being downloaded, for the loading UI. Defaulted rather than
  // required because most callers are a track's one data file, where the track
  // name is already on screen; name it wherever several files load at once
  // behind a single indicator and "Downloading file" can't say which (the four
  // parallel assembly loads, say)
  label = 'Downloading file',
) {
  // statusCallback is passed through as-is rather than defaulted to a no-op:
  // downloadStatus hands the reader an undefined onProgress when there is no
  // status channel, which is what lets generic-filehandle2 take res.arrayBuffer()
  // instead of its manual getReader() copy loop
  const { statusCallback, stopToken } = opts
  // the stop token becomes the read's signal, so a cancelled whole-file load
  // drops at the socket rather than downloading a multi-GB body to completion
  const buf = await withStopTokenSignal(stopToken, signal =>
    downloadStatus(
      label,
      statusCallback,
      onProgress =>
        loc.readFile({ ...opts, onProgress, signal }) as Promise<Uint8Array>,
    ),
  )
  // the inflater is imported dynamically because this module is reachable from
  // the core/util barrel, so a static import put bgzf-filehandle + pako
  // (~180KB) on the startup path of every page load; only an actually-gzipped
  // file needs them
  return isGzip(buf)
    ? await updateStatus(
        'Unzipping',
        statusCallback,
        async () => {
          const { unzip } = await import('@gmod/bgzf-filehandle')
          return unzip(buf)
        },
        // a cancel landing here is otherwise discovered only by whatever parses
        // the result, after a whole-file inflate has run to completion
        stopToken,
      )
    : buf
}

export async function fetchAndMaybeUnzipText(
  loc: GenericFilehandle,
  opts?: BaseOptions,
  label?: string,
) {
  const buffer = await fetchAndMaybeUnzip(loc, opts, label)
  // 512MB  max chrome string length is 512MB
  if (buffer.length > 536_870_888) {
    throw new Error('Data exceeds maximum string length (512MB)')
  }
  return new TextDecoder('utf8', { fatal: true }).decode(buffer)
}
