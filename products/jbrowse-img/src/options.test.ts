import { syntenyTrackTypes, trackTypes } from './makeConfigs.ts'
import {
  buildBatchHelp,
  buildHelp,
  getBoolean,
  getBooleanValue,
  getCigarMode,
  getColorBy,
  getFormat,
  getNumber,
  getNumberList,
  getOptionalCount,
  getOptionalNumber,
  getString,
  getThemeName,
  getTrackLabels,
  ignoredComparativeOptions,
  knownOptions,
} from './options.ts'
import { parseArgv, standardizeArgv } from './parseArgv.ts'

function parse(args: string) {
  const { trackList, ...rest } = standardizeArgv(
    parseArgv(args.split(' ')),
    trackTypes,
  )
  return rest
}

test('coerces named options to their declared types', () => {
  const rest = parse('--width 800 --refseq --loc chr1:1-100')
  expect(getNumber(rest, 'width', 1500)).toBe(800)
  expect(getBoolean(rest, 'refseq')).toBe(true)
  expect(getString(rest, 'loc')).toBe('chr1:1-100')
})

test('applies fallbacks when options are absent', () => {
  const rest = parse('--loc chr1')
  expect(getNumber(rest, 'width', 1500)).toBe(1500)
  expect(getBoolean(rest, 'refseq')).toBe(false)
  expect(getString(rest, 'fasta')).toBeUndefined()
})

test('validates trackLabels against the allowed modes', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    expect(getTrackLabels(parse('--trackLabels offset'))).toBe('offset')
    expect(getTrackLabels(parse('--trackLabels bogus'))).toBeUndefined()
  } finally {
    warn.mockRestore()
  }
})

test('warns on an invalid enum value instead of silently defaulting', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    expect(getCigarMode(parse('--cigarMode full'))).toBe('full')
    expect(getThemeName(parse('--themeName darkStock'))).toBe('darkStock')
    expect(warn).not.toHaveBeenCalled()

    expect(getCigarMode(parse('--cigarMode ful'))).toBeUndefined()
    expect(getThemeName(parse('--themeName drakStock'))).toBeUndefined()
    expect(getTrackLabels(parse('--trackLabels lft'))).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(3)
  } finally {
    warn.mockRestore()
  }
})

test('validates colorBy, which the view would silently coerce to default', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    expect(getColorBy(parse('--colorBy query'))).toBe('query')
    expect(getColorBy(parse('--colorBy meanQueryIdentity'))).toBe(
      'meanQueryIdentity',
    )
    expect(warn).not.toHaveBeenCalled()

    expect(getColorBy(parse('--colorBy quary'))).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
  } finally {
    warn.mockRestore()
  }
})

test('absent enum flags return undefined without warning', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    expect(getCigarMode(parse('--loc chr1'))).toBeUndefined()
    expect(getThemeName(parse('--loc chr1'))).toBeUndefined()
    expect(warn).not.toHaveBeenCalled()
  } finally {
    warn.mockRestore()
  }
})

describe('getBooleanValue', () => {
  test('true/false and bare flag map directly without warning', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(getBooleanValue(true, 'x')).toBe(true)
      expect(getBooleanValue('true', 'x')).toBe(true)
      expect(getBooleanValue(false, 'x')).toBe(false)
      expect(getBooleanValue('false', 'x')).toBe(false)
      expect(getBooleanValue(undefined, 'x')).toBe(false)
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  test('a loose value like "0" warns and is false (not silently truthy)', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(getBooleanValue('0', 'coverage')).toBe(false)
      expect(getBooleanValue('yes', 'coverage')).toBe(false)
      expect(getBooleanValue('ture', 'coverage')).toBe(false)
      expect(warn).toHaveBeenCalledTimes(3)
    } finally {
      warn.mockRestore()
    }
  })
})

// Numbers were the last flag type that fell back in silence: `--width 120O`
// rendered at the default 1500 with nothing said, while a bad enum or boolean
// already reported itself.
describe('numeric flags', () => {
  test('a usable number parses without warning', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(getNumber(parse('--width 1200'), 'width', 1500)).toBe(1200)
      expect(getOptionalNumber(parse('--alpha 0.4'), 'alpha')).toBe(0.4)
      expect(getOptionalNumber(parse('--loc chr1'), 'alpha')).toBeUndefined()
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  test('a non-numeric value warns and falls back rather than silently defaulting', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(getNumber(parse('--width 120O'), 'width', 1500)).toBe(1500)
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('expected a number for --width'),
      )
    } finally {
      warn.mockRestore()
    }
  })

  // `Number('')` is 0, so an empty value used to render a zero-width image
  test('a bare or empty numeric flag warns instead of becoming 0', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(getNumber(parse('--width='), 'width', 1500)).toBe(1500)
      expect(getNumber(parse('--width --loc chr1'), 'width', 1500)).toBe(1500)
      expect(warn).toHaveBeenCalledTimes(2)
    } finally {
      warn.mockRestore()
    }
  })

  // one value applies to every level, so a dropped entry read as deliberate
  test('a non-numeric levelHeights entry warns and is skipped', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(
        getNumberList(parse('--levelHeights 300,300'), 'levelHeights'),
      ).toEqual([300, 300])
      expect(
        getNumberList(parse('--levelHeights 300,abc'), 'levelHeights'),
      ).toEqual([300])
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('non-numeric entry "abc"'),
      )
    } finally {
      warn.mockRestore()
    }
  })
})

test('knownOptions covers named options including help and version', () => {
  expect(knownOptions.has('fasta')).toBe(true)
  expect(knownOptions.has('help')).toBe(true)
  expect(knownOptions.has('nonsense')).toBe(false)
})

test('help text lists options, examples, and track flags', () => {
  const help = buildHelp('jb2export', trackTypes, syntenyTrackTypes)
  expect(help).toContain('--fasta')
  expect(help).toContain('[default: 1500]')
  expect(help).toContain('Track options: --bam')
  expect(help).toContain('Comparative subcommands')
})

test('subcommand help lists comparison track options', () => {
  const help = buildHelp('jb2export', trackTypes, syntenyTrackTypes, 'dotplot')
  expect(help).toContain('Usage: jb2export dotplot')
  expect(help).toContain('--fasta2')
  expect(help).toContain('Comparison track options: --paf')
})

describe('comparative options are scoped to the modes that read them', () => {
  const dotplot = buildHelp(
    'jb2export',
    trackTypes,
    syntenyTrackTypes,
    'dotplot',
  )
  const synteny = buildHelp(
    'jb2export',
    trackTypes,
    syntenyTrackTypes,
    'synteny',
  )

  test('the ribbon-shape flags appear only under synteny', () => {
    // a dotplot has no ribbon shape and no levels, so its init carries none of
    // these — listing them documented flags that silently did nothing
    for (const flag of [
      '--drawCurves',
      '--cigarMode',
      '--alpha',
      '--levelHeights',
    ]) {
      expect(synteny).toContain(flag)
      expect(dotplot).not.toContain(flag)
    }
  })

  test('the shared comparative flags appear under both', () => {
    for (const flag of [
      '--autoDiagonalize',
      '--colorBy',
      '--minAlignmentLength',
      '--showColorLegend',
    ]) {
      expect(dotplot).toContain(flag)
      expect(synteny).toContain(flag)
    }
  })

  test('ignoredComparativeOptions names what a mode drops', () => {
    expect(ignoredComparativeOptions('dotplot')).toEqual([
      'drawCurves',
      'alpha',
      'levelHeights',
      'cigarMode',
    ])
    expect(ignoredComparativeOptions('synteny')).toEqual([])
  })
})

describe('batch options', () => {
  test('a count rejects a fraction or a negative rather than acting on it', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(getOptionalCount(parse('--limit 20'), 'limit')).toBe(20)
      expect(getOptionalCount(parse('--limit 0'), 'limit')).toBe(0)
      // `slice(0, -2)` renders all but the LAST two, silently
      expect(getOptionalCount(parse('--limit=-2'), 'limit')).toBeUndefined()
      // a negative flank inverts the window into a start-greater-than-end that
      // every record then fails on separately
      expect(getOptionalCount(parse('--flank=-500'), 'flank')).toBeUndefined()
      expect(getOptionalCount(parse('--limit 2.5'), 'limit')).toBeUndefined()
      expect(warn).toHaveBeenCalledTimes(3)
    } finally {
      warn.mockRestore()
    }
  })

  test('an unknown --format warns instead of quietly writing a PNG', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      expect(getFormat(parse('--format svg'))).toBe('svg')
      expect(getFormat(parse('--format pdf'))).toBe('pdf')
      expect(getFormat(parse('--format jpg'))).toBeUndefined()
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('unknown --format "jpg"'),
      )
    } finally {
      warn.mockRestore()
    }
  })

  test('batch help offers only what a batch can honor', () => {
    const help = buildBatchHelp('jb2export')
    for (const flag of ['--outDir', '--flank', '--limit', '--resume']) {
      expect(help).toContain(flag)
    }
    // --outDir replaces --out and the junction file replaces --loc; --spec and
    // --session fix the view, which in a batch is N identical images
    for (const flag of ['--out ', '--loc ', '--spec', '--session']) {
      expect(help).not.toContain(flag)
    }
  })
})
