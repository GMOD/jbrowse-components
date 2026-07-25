import { decodeURIComponentNoThrow } from '../util.ts'
import {
  createReadlineInterface,
  getLocalOrRemoteStream,
  parseAttributes,
} from './common.ts'

import type { IndexerOptions } from '../util.ts'

export async function* indexVcf({
  config,
  attributesToIndex,
  inLocation,
  outDir,
  onStart,
  onUpdate,
  checkAbort,
}: IndexerOptions) {
  const { trackId } = config
  const stream = await getLocalOrRemoteStream({
    file: inLocation,
    out: outDir,
    onStart,
    onUpdate,
  })

  const rl = createReadlineInterface(stream, inLocation)
  const encodedTrackId = encodeURIComponent(trackId)

  for await (const line of rl) {
    checkAbort?.()
    if (!line.trim() || line.startsWith('#')) {
      continue
    }

    const [ref, pos, id, , , , , info] = line.split('\t')

    // a valid VCF data row has at least 8 tab-delimited columns; skip blank or
    // malformed/short lines that would otherwise emit garbage records or throw
    if (
      ref === undefined ||
      pos === undefined ||
      id === undefined ||
      info === undefined
    ) {
      continue
    }

    const fields = parseAttributes(info, decodeURIComponentNoThrow)
    // an empty `END=` parses to 0 via Number(''), which is finite; require a
    // non-empty value before trusting it, else fall back to pos+1
    const endNum = Number(fields.END)
    const end = fields.END && Number.isFinite(endNum) ? endNum : Number(pos) + 1
    const locStr = `${ref}:${pos}..${end}`
    const encodedLocStr = encodeURIComponent(locStr)

    const infoAttrs = attributesToIndex
      .map(attr => fields[attr])
      .filter((f): f is string => !!f)

    // VCF separates multiple IDs with ';' (matching @gmod/vcf), not ','. '.' is
    // the no-id sentinel; such a row is still worth indexing by its INFO
    // attributes, it just has no id to search by
    const variantIds = id === '.' ? [] : id.split(';').filter(Boolean)
    // one record per id so each is separately searchable, plus an id-less
    // record when the row carries only attributes
    const attrGroups = variantIds.length
      ? variantIds.map(variantId => [variantId, ...infoAttrs])
      : [infoAttrs]

    for (const attrs of attrGroups) {
      if (attrs.length > 0) {
        // attributes go in the record so the adapter can display them, and in
        // the trailing word list so trix indexes them as searchable terms
        const encodedAttrs = attrs.map(a => `"${encodeURIComponent(a)}"`)
        const record = `["${encodedLocStr}"|"${encodedTrackId}"|${encodedAttrs.join('|')}]`

        yield `${record} ${[...new Set(attrs)].join(' ')}\n`
      }
    }
  }
}
