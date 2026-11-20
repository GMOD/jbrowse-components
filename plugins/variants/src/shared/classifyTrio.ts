export type TrioClass = 'deNovoCandidate' | 'mendelianViolation' | 'consistent'

export type PedigreeSex = 'male' | 'female' | 'other'

export interface TransmissionEntry {
  sex?: PedigreeSex
  from: 'mother' | 'father' | 'either'
}

interface Call {
  alleles: string[]
  called: string[]
  wildcards: number
}

type Mode =
  | { kind: 'entry'; from: TransmissionEntry['from'] }
  | { kind: 'union' }
  | { kind: 'split'; regular: boolean; pairs: [number, number][] }

export const MAX_CLASSIFIED_PLOIDY = 16

const severity = {
  consistent: 1,
  mendelianViolation: 2,
  deNovoCandidate: 3,
} as const

function parseCall(genotype: string): Call {
  const alleles = genotype.split(/[/|]/)
  const called = alleles.filter(a => a !== '.')
  return {
    alleles,
    called,
    wildcards: called.length === 0 ? Infinity : alleles.length - called.length,
  }
}

const absentParent: Call = { alleles: [], called: [], wildcards: Infinity }

function isHaploidOrHomozygous(child: Call) {
  return (
    child.alleles.length === 1 ||
    (child.called.length === child.alleles.length &&
      child.called.every(a => a === child.called[0]))
  )
}

function gameteSizes(parent: Call, regular: boolean) {
  const p = parent.alleles.length
  return p === 1
    ? [1]
    : regular
      ? [...new Set([Math.floor(p / 2), Math.ceil(p / 2)])]
      : Array.from({ length: p }, (_, i) => i + 1)
}

function splitPairs(
  ploidy: number,
  father: Call | undefined,
  mother: Call | undefined,
  regular: boolean,
) {
  const pairs: [number, number][] = []
  for (let a = 1; a < ploidy; a++) {
    const b = ploidy - a
    if (
      (!father || gameteSizes(father, regular).includes(a)) &&
      (!mother || gameteSizes(mother, regular).includes(b))
    ) {
      pairs.push([a, b])
    }
  }
  return pairs
}

function chooseMode(
  child: Call,
  father: Call | undefined,
  mother: Call | undefined,
  entry: TransmissionEntry | undefined,
): Mode {
  if (entry) {
    return { kind: 'entry', from: entry.from }
  } else if (child.alleles.length === 1) {
    return { kind: 'union' }
  } else {
    const regular = splitPairs(child.alleles.length, father, mother, true)
    return regular.length > 0
      ? { kind: 'split', regular: true, pairs: regular }
      : {
          kind: 'split',
          regular: false,
          pairs: splitPairs(child.alleles.length, father, mother, false),
        }
  }
}

function partFits(child: Call, mask: number, inPart: boolean, parent: Call) {
  let novel = 0
  for (let i = 0; i < child.alleles.length; i++) {
    const a = child.alleles[i]!
    if (
      ((mask >> i) & 1) === (inPart ? 1 : 0) &&
      a !== '.' &&
      !parent.called.includes(a)
    ) {
      let firstInPart = true
      for (let j = 0; j < i; j++) {
        if (((mask >> j) & 1) === (inPart ? 1 : 0) && child.alleles[j] === a) {
          firstInPart = false
        }
      }
      if (firstInPart) {
        novel++
      }
    }
  }
  return novel <= parent.wildcards
}

function popcount(mask: number) {
  let n = 0
  for (let m = mask; m; m &= m - 1) {
    n++
  }
  return n
}

function splitAssignable(
  child: Call,
  father: Call,
  mother: Call,
  pairs: [number, number][],
) {
  const n = child.alleles.length
  for (let mask = 0; mask < 1 << n; mask++) {
    const a = popcount(mask)
    if (
      pairs.some(([fa]) => fa === a) &&
      partFits(child, mask, true, father) &&
      partFits(child, mask, false, mother)
    ) {
      return true
    }
  }
  return false
}

function novelCount(child: Call, parents: Call[]) {
  return new Set(
    child.called.filter(a => !parents.some(p => p.called.includes(a))),
  ).size
}

function assignable(child: Call, father: Call, mother: Call, mode: Mode) {
  if (mode.kind === 'split') {
    return splitAssignable(child, father, mother, mode.pairs)
  } else if (mode.kind === 'entry' && mode.from !== 'either') {
    const parent = mode.from === 'father' ? father : mother
    return novelCount(child, [parent]) <= parent.wildcards
  } else {
    return (
      novelCount(child, [father, mother]) <= father.wildcards + mother.wildcards
    )
  }
}

function classifyWithSex(
  child: Call,
  father: Call | undefined,
  mother: Call | undefined,
  sex: PedigreeSex | undefined,
  rule: readonly TransmissionEntry[],
) {
  const entry = rule.find(
    e => e.sex === undefined || (e.sex === sex && isHaploidOrHomozygous(child)),
  )
  const mode = chooseMode(child, father, mother, entry)
  const f = father ?? absentParent
  const m = mother ?? absentParent
  const known = father ?? mother ?? absentParent
  const isDuo = !father || !mother
  const singleParent = mode.kind === 'entry' && mode.from !== 'either'
  const contributors = singleParent
    ? [mode.from === 'father' ? father : mother]
    : [father, mother]
  const setBased = mode.kind !== 'split'
  const unsettledDuo =
    isDuo &&
    (singleParent
      ? contributors[0] === undefined
      : setBased && novelCount(child, [known]) > 0)

  return !isDuo &&
    novelCount(child, [f, m]) > 0 &&
    contributors.every(p => p?.wildcards === 0)
    ? 'deNovoCandidate'
    : unsettledDuo
      ? undefined
      : (singleParent || (mode.kind === 'split' && mode.regular)) &&
          !assignable(child, f, m, mode)
        ? 'mendelianViolation'
        : child.wildcards === 0 &&
            contributors.every(p => !p || p.wildcards === 0) &&
            assignable(child, f, m, mode)
          ? 'consistent'
          : undefined
}

export function classifyTrio(
  child: string,
  father: string | undefined,
  mother: string | undefined,
  {
    sex,
    rule,
  }: { sex: PedigreeSex | undefined; rule: readonly TransmissionEntry[] },
) {
  const childCall = parseCall(child)
  const fatherCall = father === undefined ? undefined : parseCall(father)
  const motherCall = mother === undefined ? undefined : parseCall(mother)
  if (
    (!fatherCall && !motherCall) ||
    childCall.alleles.length > MAX_CLASSIFIED_PLOIDY
  ) {
    return undefined
  } else if (sex === undefined && rule.some(e => e.sex !== undefined)) {
    const asMale = classifyWithSex(
      childCall,
      fatherCall,
      motherCall,
      'male',
      rule,
    )
    const asFemale = classifyWithSex(
      childCall,
      fatherCall,
      motherCall,
      'female',
      rule,
    )
    return asMale === asFemale ? asMale : undefined
  } else {
    return classifyWithSex(childCall, fatherCall, motherCall, sex, rule)
  }
}

export function mostSevereTrioClass(
  classes: readonly (TrioClass | undefined)[],
) {
  let worst: TrioClass | undefined
  for (let i = 0; i < classes.length; i++) {
    const c = classes[i]
    if (c !== undefined && (!worst || severity[c] > severity[worst])) {
      worst = c
    }
  }
  return worst
}
