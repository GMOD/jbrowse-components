import { parseModHeader } from './consts.ts'

/**
 * How one MM header's type string splits into modification types.
 *
 * A multi-character LOWERCASE type string is a combined code — `C+mh` is 5mC
 * and 5hmC called at the same positions — so each character is its own type. A
 * single character, or anything starting outside a-z (a ChEBI number like
 * `C+16061`, an uppercase ambiguity code like `C+C`), is one type whole.
 *
 * Stated once because `getModPositions` and `getModTypes` both have to split
 * the same way: the second exists to answer "which types are here" without the
 * first's work, and a disagreement would show as a modification the menu offers
 * and the display cannot draw.
 */
export function isSingleModType(typestr: string) {
  return typestr.charCodeAt(0) < 97 || typestr.length === 1
}

export interface ModTypeHeader {
  type: string
  base: string
  strand: string
}

/**
 * #api
 * The modification types an MM tag declares, from its headers alone.
 *
 * `getModPositions` answers this too, but on the way to placing every call: it
 * walks the delta list against the read sequence, which is the expensive half
 * and is only needed to DRAW marks. Anything that just wants to know what is in
 * the file — which types to offer in a menu, whether a track carries
 * modifications at all — wants this instead, and pays neither the walk nor the
 * sequence decode that feeds it.
 */
export function getModTypes(mm: string): ModTypeHeader[] {
  const out: ModTypeHeader[] = []
  for (const group of mm.split(';')) {
    if (group === '') {
      continue
    }
    const comma = group.indexOf(',')
    const basemod = comma === -1 ? group : group.slice(0, comma)
    const { base, strand, typestr } = parseModHeader(basemod, group)
    if (isSingleModType(typestr)) {
      out.push({ type: typestr, base, strand })
    } else {
      for (let i = 0, l = typestr.length; i < l; i++) {
        out.push({ type: typestr[i]!, base, strand })
      }
    }
  }
  return out
}
