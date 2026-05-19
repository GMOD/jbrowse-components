import { parseModHeader } from './consts.ts'

export function getModTypes(mm: string) {
  const result: { type: string; base: string; strand: string }[] = []
  const mods = mm.split(';')
  for (let i = 0, modsLen = mods.length; i < modsLen; i++) {
    const mod = mods[i]!
    if (mod === '') {
      continue
    }

    const basemod = mod.split(',')[0]!
    const { base, strand, typestr } = parseModHeader(basemod, mod)
    // Note: mod field ('.' or '?') indicates how skipped bases are interpreted
    // but for getModTypes we only need base, strand, and typestr

    // can be a multi e.g. C+mh for both meth (m) and hydroxymeth (h) so split,
    // and they can also be chemical codes (ChEBI) e.g. C+16061
    // Avoid creating array for single types (uppercase or all digits)
    const isSingleType = typestr.charCodeAt(0) < 97 || typestr.length === 1

    if (isSingleType) {
      result.push({
        type: typestr,
        base,
        strand,
      })
    } else {
      // Multi-char lowercase: each character is a separate type
      for (let j = 0, len = typestr.length; j < len; j++) {
        result.push({
          type: typestr[j]!,
          base,
          strand,
        })
      }
    }
  }
  return result
}
