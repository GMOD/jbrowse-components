import { modificationRegex } from './consts.ts'

export function getModTypes(mm: string) {
  const result = []
  const mods = mm.split(';')
  for (let i = 0, modsLen = mods.length; i < modsLen; i++) {
    const mod = mods[i]!
    if (mod === '') {
      continue
    }

    const basemod = mod.split(',')[0]!
    const matches = modificationRegex.exec(basemod)
    if (!matches) {
      throw new Error(`bad format for MM tag: "${mod}"`)
    }

    const base = matches[1]!
    const strand = matches[2]!
    const typestr = matches[3]!

    // can be a multi e.g. C+mh for both meth (m) and hydroxymeth (h) so split,
    // and they can also be chemical codes (ChEBI) e.g. C+16061
    const types = typestr.split(/(\d+|.)/)

    for (let j = 0, typesLen = types.length; j < typesLen; j++) {
      const type = types[j]!
      if (type === '') {
        continue
      }
      result.push({
        type,
        base,
        strand,
      })
    }
  }
  return result
}
