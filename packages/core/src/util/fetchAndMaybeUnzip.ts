import { downloadStatus, updateStatus } from './progress.ts'

import type { BaseOptions } from '../data_adapters/BaseAdapter/index.ts'
import type { GenericFilehandle } from 'generic-filehandle2'

export function isGzip(buf: Uint8Array) {
  return buf[0] === 31 && buf[1] === 139 && buf[2] === 8
}

export async function fetchAndMaybeUnzip(
  loc: GenericFilehandle,
  opts: BaseOptions = {},
) {
  const { statusCallback = () => {} } = opts
  const buf = await downloadStatus(
    'Downloading file',
    statusCallback,
    onProgress => loc.readFile({ ...opts, onProgress }) as Promise<Uint8Array>,
  )
  // the inflater is imported dynamically because this module is reachable from
  // the core/util barrel, so a static import put bgzf-filehandle + pako
  // (~180KB) on the startup path of every page load; only an actually-gzipped
  // file needs them
  return isGzip(buf)
    ? await updateStatus('Unzipping', statusCallback, async () => {
        const { unzip } = await import('@gmod/bgzf-filehandle')
        return unzip(buf)
      })
    : buf
}

export async function fetchAndMaybeUnzipText(
  loc: GenericFilehandle,
  opts?: BaseOptions,
) {
  const buffer = await fetchAndMaybeUnzip(loc, opts)
  // 512MB  max chrome string length is 512MB
  if (buffer.length > 536_870_888) {
    throw new Error('Data exceeds maximum string length (512MB)')
  }
  return new TextDecoder('utf8', { fatal: true }).decode(buffer)
}
