import { redactSource } from './getLocationUri.ts'
import { downloadStatus, phaseOf, updateStatus } from './progress.ts'
import { withStopTokenSignal } from './stopToken.ts'

import type { BaseOptions } from '../data_adapters/BaseAdapter/index.ts'
import type { StatusPhase } from './progress.ts'
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
  // parallel assembly loads, say). The URL is not the caller's to supply — see
  // below
  label: string | StatusPhase = 'Downloading file',
) {
  // statusCallback is passed through as-is rather than defaulted to a no-op, so
  // that "nobody is listening" reaches the reader: downloadStatus then hands it
  // no onProgress and generic-filehandle2 takes `res.bytes()` rather than its
  // getReader loop.
  //
  // **That is not the faster path, and this comment used to say it was.** In a
  // Chrome worker the loop is ~1.8x faster up to 10MB and only ~1.1x slower past
  // ~25MB — agent-docs/measurements/download-read-path.json. What withholding it
  // buys is that a caller who asked for no reporting gets none, here and in the
  // worker alike; the read speed is a wash at best and against us at the sizes a
  // whole-file load usually is.
  // Where a stalled load gets the URL it names, and the reason no call site
  // passes one: `loc` knows. Every filehandle `openLocation` builds carries the
  // address it was constructed with (generic-filehandle2 2.4.0), so this is true
  // of every download in the tree rather than of the handful that remembered to
  // say so. A Blob and a FileHandle report nothing, which is right — their bytes
  // came from the user and there is no server to go and check.
  //
  // Redacted here rather than at the source, because the handle's `source` is
  // verbatim what it fetches (a presigned URL keeps its signature) and this is
  // the layer that hands it to a display.
  const phase =
    loc.source === undefined
      ? label
      : { message: phaseOf(label), source: redactSource(loc.source) }
  const { statusCallback, stopToken } = opts
  // the stop token becomes the read's signal, so a cancelled whole-file load
  // drops at the socket rather than downloading a multi-GB body to completion
  const buf = await withStopTokenSignal(stopToken, signal =>
    downloadStatus(
      phase,
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
  label?: string | StatusPhase,
) {
  const buffer = await fetchAndMaybeUnzip(loc, opts, label)
  // 512MB  max chrome string length is 512MB
  if (buffer.length > 536_870_888) {
    throw new Error('Data exceeds maximum string length (512MB)')
  }
  return new TextDecoder('utf8', { fatal: true }).decode(buffer)
}
