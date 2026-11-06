import { vcfRecordSpan } from '@jbrowse/add-track-core'

import { decodeURIComponentNoThrow, trixLine } from '../util.ts'
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

  for await (const line of rl) {
    checkAbort?.()
    if (!line.trim() || line.startsWith('#')) {
      continue
    }

    const [ref, pos, id, refAllele, alt, , , info] = line.split('\t')

    // a valid VCF data row has at least 8 tab-delimited columns; skip blank or
    // malformed/short lines that would otherwise emit garbage records or throw
    if (
      ref === undefined ||
      pos === undefined ||
      id === undefined ||
      refAllele === undefined ||
      alt === undefined ||
      info === undefined
    ) {
      continue
    }

    const fields = parseAttributes(info, decodeURIComponentNoThrow)
    const { start, end } = vcfRecordSpan({
      POS: Number(pos),
      REF: refAllele,
      ALT: alt === '.' ? [] : alt.split(','),
      INFO: { END: [fields.END], SVLEN: fields.SVLEN?.split(' ') },
    })
    const locStr = `${ref}:${start + 1}..${end}`

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
        yield trixLine(locStr, trackId, attrs)
      }
    }
  }
}
