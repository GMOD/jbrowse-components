import { isPlainObject } from '../util/objectUtils.ts'

/** The two spellings a tabix or BAM index type comes in, per adapter family. */
export type SiblingIndexType = 'TBI' | 'BAI'
export type IndexType = SiblingIndexType | 'CSI'

/** The extension an index of this type carries: `CSI` → `.csi`, `TBI` → `.tbi`. */
export function indexSuffix(indexType: IndexType) {
  return `.${indexType.toLowerCase()}`
}

/**
 * Whether a file location names a CSI. htslib writes `.csi` in place of a `.bai`
 * or a `.tbi` for a reference over 512 Mb, and on request at any size, so the
 * extension is the one thing that distinguishes the two parsers.
 */
export function isCsiLocation(location: unknown) {
  if (!isPlainObject(location)) {
    return false
  }
  const { uri, localPath } = location
  const name = typeof uri === 'string' ? uri : localPath
  // the query string a presigned url carries sits after the name
  return typeof name === 'string' && /\.csi$/i.test(name.split(/[?#]/)[0]!)
}

/**
 * The `indexType` an index sub-schema's snapshot means, filled in from the
 * location it names where it states none — so an author who picks a
 * `<file>.gz.csi` out of a file dialog gets a CSI without also having to say so.
 * Only CSI is ever filled in: the sibling format is the slot's own default, so a
 * `.tbi` or a `.bai` needs nothing said either way.
 *
 * This runs on the way into MST, which is what makes it cover every path a
 * config arrives by rather than just the `uri` shorthand: a hand-written long
 * form, and an add-track form that writes only a location. The synteny form the
 * dotplot guide sends a `jbrowse make-pif --csi` user to is the second kind — it
 * offers a ".tbi or .csi" file picker and wrote no `indexType` at all, so a
 * picked `.csi` reached @gmod/tabix as a `tbiFilehandle`.
 */
export function fillIndexType(snap: Record<string, unknown>) {
  return snap.indexType === undefined && isCsiLocation(snap.location)
    ? { ...snap, indexType: 'CSI' }
    : snap
}
