import { isPlainObject } from '../util/objectUtils.ts'

/** The sibling index format of a family: TBI for tabix, BAI for BAM. */
export type SiblingIndexType = 'TBI' | 'BAI'
export type IndexType = SiblingIndexType | 'CSI'

/** The extension an index of this type carries: `CSI` → `.csi`, `TBI` → `.tbi`. */
export function indexSuffix(indexType: IndexType) {
  return `.${indexType.toLowerCase()}`
}

/**
 * Whether a file location names a CSI. htslib writes `.csi` in place of a `.bai`
 * or a `.tbi` for a reference over 512 Mb and on request at any size, so the
 * extension is the only thing distinguishing the two parsers.
 *
 * `makeIndexType` in `util/tracks.ts` asks this of a bare filename, for the
 * guessers and add-track forms that WRITE an `indexType` beside the location.
 * Those stay: a config the CLI or jbrowse-img writes is read by older JBrowse
 * versions, which have no inference to fall back on.
 */
export function isCsiLocation(location: unknown) {
  if (!isPlainObject(location)) {
    return false
  }
  const { uri, localPath } = location
  const name = typeof uri === 'string' ? uri : localPath
  // a presigned url carries its query string after the name
  return typeof name === 'string' && /\.csi$/i.test(name.split(/[?#]/)[0]!)
}

/**
 * An index sub-schema's snapshot with `indexType` filled in from the location it
 * names, where it states none. Only CSI is ever filled in — the sibling format
 * is the slot's own default.
 *
 * Belongs to the sub-schema rather than to the `uri` shorthand because it has to
 * cover the paths no shorthand runs on: a long-form config, and an add-track
 * form that writes a location and nothing else.
 */
export function fillIndexType(snap: Record<string, unknown>) {
  return snap.indexType === undefined && isCsiLocation(snap.location)
    ? { ...snap, indexType: 'CSI' }
    : snap
}
