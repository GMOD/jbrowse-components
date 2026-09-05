import { assembleLocStringRaw } from '@jbrowse/core/util'

import type { Region } from '@jbrowse/core/util'

/**
 * What the FASTA download saves itself as. Every download used to be
 * `sequence.fasta`, so a second locus overwrote the first in the browser's
 * download folder — or landed beside it as `sequence (1).fasta`, which names
 * neither locus.
 *
 * The coordinates are `assembleLocStringRaw`'s, the 1-based pair the rest of
 * the app shows, with `:` and `..` swapped for characters every filesystem
 * accepts. Falls back to the old name when the widget has no region.
 */
export function fastaFileName(region: Region | undefined) {
  return region
    ? `${assembleLocStringRaw(region).replace(':', '_').replace('..', '-')}.fasta`
    : 'sequence.fasta'
}
