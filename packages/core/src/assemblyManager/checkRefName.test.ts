import { checkRefName } from './refNameMaps.ts'

// The SAM spec's reference-name grammar (SAMv1 §1.2.1). The regex is quoted from
// the spec, but it used to be applied unanchored, which turns a grammar for a
// whole name into a search for one legal character anywhere in it. So the check
// accepted everything except names made entirely of illegal characters.
function accepts(refName: string) {
  try {
    checkRefName(refName)
    return true
  } catch {
    return false
  }
}

test('accepts the names real genomes actually use', () => {
  for (const name of [
    'chr1',
    '1',
    'chrUn_KI270302v1',
    'NC_000001.11',
    'GL000009.2',
    'chrEBV',
    'HLA-A*01:01:01:01', // `*` and `=` are legal after the first character
    'scaffold_1|quiver',
    'chr1_KI270706v1_random',
  ]) {
    expect([name, accepts(name)]).toEqual([name, true])
  }
})

test('rejects a name that is only illegal characters', () => {
  for (const name of ['', '*', '=', '[]']) {
    expect([name, accepts(name)]).toEqual([name, false])
  }
})

// What the unanchored form let through. The whitespace cases are the ones that
// bite: an unindexed FASTA whose defline separates id from description with a
// tab yields exactly this, and the name then breaks every locstring and url
// built from it.
test('rejects a name that merely contains something legal', () => {
  for (const name of [
    'chr 1',
    ' chr1',
    'chr1\tdescription of the contig',
    'chr1 dna:chromosome',
    'x[bad]',
    'a,b',
    'chr"1"',
    'chr(1)',
    'chr\\1',
  ]) {
    expect([name, accepts(name)]).toEqual([name, false])
  }
})

test('rejects a leading * or = but allows them later', () => {
  expect(accepts('*chr1')).toBe(false)
  expect(accepts('=chr1')).toBe(false)
  expect(accepts('chr*1')).toBe(true)
  expect(accepts('chr=1')).toBe(true)
})

test('says what is wrong with the name it rejects', () => {
  expect(() => {
    checkRefName('chr 1')
  }).toThrow(/invalid refName: "chr 1"/)
})
