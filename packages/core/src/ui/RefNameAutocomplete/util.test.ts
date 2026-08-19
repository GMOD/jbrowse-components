import BaseResult from '../../TextSearch/BaseResults.ts'
import { MAX_GLOB_REGIONS } from '../../util/selectNamedRegions.ts'
import {
  adornmentReservePx,
  cap,
  coerceToResult,
  getDeduplicatedResult,
  getInputWidth,
  getOptionLabel,
  getRefNameOptions,
} from './util.ts'

const opt = (label: string) => ({ result: new BaseResult({ label }) })

describe('cap', () => {
  it('leaves a short list untouched', () => {
    const options = [opt('a'), opt('b')]
    expect(cap(options)).toBe(options)
  })

  it('truncates and appends a single disabled limit row past the cap', () => {
    const options = Array.from({ length: 150 }, (_, i) => opt(`ref${i}`))
    const capped = cap(options)

    expect(capped).toHaveLength(101)
    const last = capped.at(-1)!
    expect(last.isLimit).toBe(true)
    expect(last.result.getLabel()).toBe('keep typing for more results')
    expect(capped.slice(0, 100).every(o => !o.isLimit)).toBe(true)
  })
})

describe('getRefNameOptions', () => {
  // an assembly with no aliases of its own. `allRefNames` still lists every
  // region, because buildRefNameMaps identity-maps each one — an assembly whose
  // regions are loaded always answers to at least its own names
  const regions = (refNames: string[]) => ({
    regions: refNames.map(refName => ({ refName })),
    allRefNames: refNames,
    getCanonicalRefName: (n: string) => n,
  })

  it('matches case-insensitively on a substring of the refName', () => {
    expect(
      getRefNameOptions(regions(['chr1', 'chr2', 'ctgA']), 'CHR').map(
        getOptionLabel,
      ),
    ).toEqual(['chr1', 'chr2'])
  })

  it('returns every refName for an empty query', () => {
    expect(getRefNameOptions(regions(['chr1', 'ctgA']), '')).toHaveLength(2)
  })

  it('resolves to a location so a picked refName navigates', () => {
    const [option] = getRefNameOptions(regions(['ctgA']), 'ctg')
    expect(option!.result.getLocation()).toBe('ctgA')
  })

  it('stops one past the cap so the list stays bounded', () => {
    const many = regions(Array.from({ length: 5000 }, (_, i) => `chr${i}`))
    expect(getRefNameOptions(many, 'chr')).toHaveLength(101)
  })

  it('finds a match past the cap (regression: list was sliced before filtering)', () => {
    const many = regions(Array.from({ length: 5000 }, (_, i) => `scaffold${i}`))
    expect(getRefNameOptions(many, 'scaffold4999').map(getOptionLabel)).toEqual(
      ['scaffold4999'],
    )
  })
})

describe('getRefNameOptions globs', () => {
  // an assembly with no aliases of its own. `allRefNames` still lists every
  // region, because buildRefNameMaps identity-maps each one — an assembly whose
  // regions are loaded always answers to at least its own names
  const regions = (refNames: string[]) => ({
    regions: refNames.map(refName => ({ refName })),
    allRefNames: refNames,
    getCanonicalRefName: (n: string) => n,
  })
  const hap = regions([
    'chr1_hap1',
    'chr2_hap1',
    'chr1_hap2',
    'chr2_hap2',
    'chrUn',
  ])
  const labels = (options: ReturnType<typeof getRefNameOptions>) =>
    options.map(getOptionLabel)

  it('reads * as an anchored glob', () => {
    // a bare `_hap1` substring-matches the same two, but `*_hap1` is anchored,
    // so this is the glob's answer rather than the substring filter's
    expect(labels(getRefNameOptions(hap, '*_hap1')).slice(1)).toEqual([
      'chr1_hap1',
      'chr2_hap1',
    ])
  })

  it('offers one option that selects every match, as a multi-region locstring', () => {
    const [all] = getRefNameOptions(hap, '*_hap1')
    expect(all!.result.getLabel()).toBe('Show all 2 regions matching *_hap1')
    // the whitespace-separated form parseLocStrings already takes, so picking
    // this needs no navigation code of its own
    expect(all!.result.getLocation()).toBe('chr1_hap1 chr2_hap1')
  })

  it('offers no bulk row when the glob matches a single region', () => {
    expect(labels(getRefNameOptions(hap, '*Un'))).toEqual(['chrUn'])
  })

  it('leaves a query with no * exactly as it was', () => {
    expect(labels(getRefNameOptions(hap, 'hap1'))).toEqual([
      'chr1_hap1',
      'chr2_hap1',
    ])
  })

  // `*` is a legal refName character — GRCh38's ALT decoys are HLA allele names
  // — so the literal reading has to survive alongside the pattern one
  const hla = regions([
    'HLA-A*01:01:01:01',
    'HLA-A*02:53N',
    'HLA-A*24:01:01:01',
  ])

  it('finds a refName that itself contains a *, typed in full', () => {
    // the glob reading of this text is ^HLA-A.*01:01:01:01$, which happens to
    // match only the allele typed — but the substring reading finds it too, so
    // it is in the list either way, which is the property that matters
    expect(labels(getRefNameOptions(hla, 'HLA-A*01:01:01:01'))).toEqual([
      'HLA-A*01:01:01:01',
    ])
  })

  it('globs a starred name that names no refName exactly', () => {
    expect(labels(getRefNameOptions(hla, 'HLA-A*')).slice(1)).toEqual([
      'HLA-A*01:01:01:01',
      'HLA-A*02:53N',
      'HLA-A*24:01:01:01',
    ])
  })

  it('keeps a literal hit the anchored glob would have dropped', () => {
    // the union is doing real work here: `^a.*b$` does not match the embedded
    // form, and the substring filter — which is what the box has always done —
    // is the only reason it is still offered
    expect(
      labels(getRefNameOptions(regions(['a*b', 'xxa*byy']), 'a*b')),
    ).toEqual(['a*b', 'xxa*byy'])
  })

  // Enter checks the refName reading before its glob branch, so a box offering
  // "Show all N regions matching …" above the contig that text names is
  // promising a set the same keystroke does not open
  it('withholds the bulk row when the text names a refName outright', () => {
    const options = getRefNameOptions(hla, 'HLA-A*24:01:01:01')
    expect(labels(options)).toEqual(['HLA-A*24:01:01:01'])
    expect(options.some(o => o.result.getLocation()?.includes(' '))).toBe(false)
  })

  it('leads with the refName the text names, not with assembly order', () => {
    const embedded = regions(['xxa*byy', 'a*b', 'zza*bzz'])
    expect(labels(getRefNameOptions(embedded, 'a*b'))).toEqual([
      'a*b',
      'xxa*byy',
      'zza*bzz',
    ])
  })

  it('withholds the bulk row past the ceiling rather than truncating it', () => {
    const many = regions(
      Array.from(
        { length: MAX_GLOB_REGIONS + 5 },
        (_, i) => `scaffold${i}_alt`,
      ),
    )
    const options = getRefNameOptions(many, '*_alt')
    // a bulk row reading "all of them" that navigates to the first thousand is
    // the one thing not worth offering; the individual rows still list
    expect(options[0]!.result.getLabel()).toBe('scaffold0_alt')
    expect(options).toHaveLength(101)
  })

  it('still bounds the visible list for a glob matching thousands', () => {
    const many = regions(
      Array.from({ length: 5000 }, (_, i) => `scaffold${i}_alt`),
    )
    expect(getRefNameOptions(many, '*_alt')).toHaveLength(101)
  })
})

describe('getRefNameOptions aliases', () => {
  // an Ensembl/NCBI-named assembly carrying UCSC aliases, which is the ordinary
  // case for anyone whose FASTA and whose habits disagree
  const aliasOf: Record<string, string> = { chr1: '1', chr2: '2', chrM: 'MT' }
  const ensembl = {
    regions: [{ refName: '1' }, { refName: '2' }, { refName: 'MT' }],
    // as an assembly builds it: aliases AND the canonical names, identity-mapped
    allRefNames: ['chr1', 'chr2', 'chrM', '1', '2', 'MT'],
    getCanonicalRefName: (n: string) => aliasOf[n] ?? n,
  }
  const labels = (options: ReturnType<typeof getRefNameOptions>) =>
    options.map(getOptionLabel)

  it('globs against aliases and labels with the canonical name', () => {
    // the bug: matching `regions` alone saw only 1/2/MT, so `chr*` — which the
    // text-search half of this same dropdown can never answer, since nothing
    // PREFIX-matches the literal `chr*` — found nothing at all
    expect(labels(getRefNameOptions(ensembl, 'chr*')).slice(1)).toEqual([
      '1',
      '2',
      'MT',
    ])
  })

  it('takes a region once when several of its names match', () => {
    const many = {
      regions: [{ refName: '1' }],
      allRefNames: ['chr1', 'NC_000001.11', '1'],
      getCanonicalRefName: () => '1',
    }
    expect(labels(getRefNameOptions(many, '*1*'))).toEqual(['1'])
  })

  it('lists alias matches in assembly order, not alias-list order', () => {
    const scrambled = { ...ensembl, allRefNames: ['chrM', 'chr2', 'chr1'] }
    expect(labels(getRefNameOptions(scrambled, 'chr*')).slice(1)).toEqual([
      '1',
      '2',
      'MT',
    ])
  })

  it('substring queries reach aliases too, so the two readings agree', () => {
    expect(labels(getRefNameOptions(ensembl, 'chrM'))).toEqual(['MT'])
  })

  it('lists nothing for an unloaded assembly, without consulting the aliases', () => {
    // setLoaded writes regions and refNameAliases together, so this is the only
    // shape "not loaded yet" takes — there is no half-loaded assembly with
    // regions but no names, and so no canonical-only path to fall back to.
    // getCanonicalRefName THROWS in this state, which is what the call asserts
    const unloaded = {
      getCanonicalRefName: () => {
        throw new Error('aliases not loaded')
      },
    }
    expect(getRefNameOptions(unloaded, '*')).toEqual([])
    expect(getRefNameOptions(undefined, 'chr')).toEqual([])
  })
})

describe('getDeduplicatedResult', () => {
  it('keeps a unique hit as a plain option', () => {
    const [option] = getDeduplicatedResult([
      new BaseResult({ label: 'chr1', displayString: 'chr1:1..100' }),
    ])

    expect(option!.result.results).toBeUndefined()
    expect(option!.result.getDisplayString()).toBe('chr1:1..100')
  })

  it('collapses hits sharing a display string into one multi-result option', () => {
    const dupes = [
      new BaseResult({ label: 'BRCA', displayString: 'chr1:1..100' }),
      new BaseResult({ label: 'BRCA', displayString: 'chr1:1..100' }),
    ]
    const result = getDeduplicatedResult(dupes)

    expect(result).toHaveLength(1)
    expect(result[0]!.result.results).toHaveLength(2)
    expect(result[0]!.result.getLabel()).toBe('chr1:1..100')
  })

  it('preserves distinct display strings as separate options', () => {
    const result = getDeduplicatedResult([
      new BaseResult({ label: 'a', displayString: 'chr1:1..100' }),
      new BaseResult({ label: 'b', displayString: 'chr2:1..100' }),
    ])
    expect(result).toHaveLength(2)
  })
})

describe('coerceToResult', () => {
  it('wraps a raw freeSolo string into a BaseResult', () => {
    expect(coerceToResult('chr1:1-100').getLabel()).toBe('chr1:1-100')
  })

  it('unwraps a selected option to its result', () => {
    const option = opt('chr1')
    expect(coerceToResult(option)).toBe(option.result)
  })
})

describe('getOptionLabel', () => {
  it('returns a raw string as-is', () => {
    expect(getOptionLabel('chr1')).toBe('chr1')
  })

  it('uses the display string of an option', () => {
    expect(
      getOptionLabel({
        result: new BaseResult({ label: 'chr1', displayString: 'chr1:1..100' }),
      }),
    ).toBe('chr1:1..100')
  })
})

describe('getInputWidth', () => {
  it('clamps an empty value up to minWidth', () => {
    expect(getInputWidth('', 200, 550)).toBe(200)
  })

  it('clamps a very long value down to maxWidth', () => {
    expect(getInputWidth('x'.repeat(500), 200, 550)).toBe(550)
  })

  it('grows with the measured text between the bounds', () => {
    const short = getInputWidth('chr1', 50, 550)
    const long = getInputWidth('chr1:1,000,000..2,000,000', 50, 550)
    expect(long).toBeGreaterThan(short)
    expect(long).toBeLessThanOrEqual(550)
  })

  it('quantizes so a small length change does not reflow the box', () => {
    // crossing 99,999 -> 100,000 grows the string by a digit+comma (~8px) but
    // both land in the same step, which is what stops the header jittering as
    // the user pans/zooms
    expect(getInputWidth('chr1:1..99,999', 50, 550)).toBe(
      getInputWidth('chr1:1..100,000', 50, 550),
    )
  })

  it('returns a multiple of the quantization step between the bounds', () => {
    expect(getInputWidth('chr1:1..2,000,000', 50, 550) % 30).toBe(0)
  })

  it('reserves less width when the adornment is smaller', () => {
    const withHelp = getInputWidth('chr1:1..2,000,000', 50, 550, 100)
    const withoutHelp = getInputWidth('chr1:1..2,000,000', 50, 550, 70)
    expect(withoutHelp).toBeLessThan(withHelp)
  })
})

// EndAdornment.test.tsx pins the render side of these: the ⋮ button appears for
// injected rows with no help, and disappears when there is neither
describe('adornmentReservePx', () => {
  it('reserves nothing extra for a box with no overflow menu', () => {
    expect(adornmentReservePx({})).toBe(adornmentReservePx({ showHelp: false }))
  })

  it('reserves the button for help alone', () => {
    expect(adornmentReservePx({ showHelp: true })).toBeGreaterThan(
      adornmentReservePx({}),
    )
  })

  it('reserves the button for injected rows with help off', () => {
    // the header box in a stacked view: showHelp={false}, but a recent location
    // draws the button anyway, and the locstring lost that width to it
    expect(adornmentReservePx({ showHelp: false, menuItemCount: 1 })).toBe(
      adornmentReservePx({ showHelp: true }),
    )
  })
})
