import {
  exportBooleanFlags,
  parseArgv,
  standardizeArgv,
} from '@jbrowse/launch-args'

import { syntenyTrackTypes, trackTypes } from './makeConfigs.ts'
import {
  buildBatchHelp,
  buildFullHelp,
  buildHelp,
  getBoolean,
  getFormat,
  getNumber,
  getOptionalCount,
  getOptionalNumber,
  getPageWidth,
  getString,
  getThemeName,
  getTrackLabels,
  knownOptions,
  optionsWithBooleanDefaults,
  optionsWithoutEffect,
} from './options.ts'

function parse(args: string) {
  const { trackList, ...rest } = standardizeArgv(
    parseArgv(args.split(' ')),
    trackTypes,
  )
  return rest
}

test("launch-args' boolean flags are the options with a boolean default", () => {
  expect([...exportBooleanFlags].toSorted()).toEqual(
    optionsWithBooleanDefaults.toSorted(),
  )
})

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

test('a page width needs its unit', () => {
  expect(getPageWidth(parse('--pageWidth 183mm'))).toBe('183mm')
  expect(getPageWidth(parse('--loc chr1'))).toBeUndefined()
  expect(() => getPageWidth(parse('--pageWidth 183'))).toThrow(
    '--pageWidth needs a width with its unit, such as 183mm or 7in, got "183"',
  )
})

test('an enum flag takes one of its values and refuses any other', () => {
  expect(getTrackLabels(parse('--trackLabels offset'))).toBe('offset')
  expect(getThemeName(parse('--themeName stock'))).toBe('stock')
  expect(getThemeName(parse('--loc chr1'))).toBeUndefined()
  expect(() => getThemeName(parse('--themeName darkStock'))).toThrow(
    '--themeName takes one of',
  )
  expect(() => getTrackLabels(parse('--trackLabels lft'))).toThrow('got "lft"')
})

test('a boolean flag takes true, false or nothing, and refuses a loose value', () => {
  expect(getBoolean(parse('--refseq'), 'refseq')).toBe(true)
  expect(getBoolean(parse('--refseq true'), 'refseq')).toBe(true)
  expect(getBoolean(parse('--refseq false'), 'refseq')).toBe(false)
  expect(getBoolean(parse('--loc chr1'), 'refseq')).toBe(false)
  for (const loose of ['0', 'yes']) {
    expect(() => getBoolean({ refseq: loose }, 'refseq')).toThrow(
      `--refseq takes true or false, got "${loose}"`,
    )
  }
})

describe('numeric flags', () => {
  test('a usable number parses', () => {
    expect(getNumber(parse('--width 1200'), 'width', 1500)).toBe(1200)
    expect(getOptionalNumber(parse('--jobs 4'), 'jobs')).toBe(4)
    expect(getOptionalNumber(parse('--loc chr1'), 'jobs')).toBeUndefined()
  })

  test('a non-numeric value is refused rather than rendering at the default', () => {
    expect(() => getNumber(parse('--width 120O'), 'width', 1500)).toThrow(
      '--width needs a number, got "120O"',
    )
  })

  // `Number('')` is 0, so an empty value used to render a zero-width image
  test('a bare or empty numeric flag is refused instead of becoming 0', () => {
    expect(() => getNumber(parse('--width='), 'width', 1500)).toThrow(
      '--width needs a number',
    )
    expect(() => getNumber(parse('--width --loc chr1'), 'width', 1500)).toThrow(
      '--width needs a number',
    )
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
  expect(help).toContain('Other views')
})

// `batch` is a subcommand a user can type, and main.ts names it in the error
// for an unknown one — but --help listed neither it nor any of its options, so
// the only way to find it was to already know it was there.
test('the top-level help names the batch subcommand', () => {
  const help = buildHelp('jb2export', trackTypes, syntenyTrackTypes)
  expect(help).toContain('jb2export batch --sites')
})

// The docs embed this as the complete help, so every subcommand's options have
// to be in it.
test('the full help reference carries every subcommand, batch included', () => {
  const help = buildFullHelp('jb2export', trackTypes, syntenyTrackTypes)
  for (const mode of ['dotplot', 'synteny', 'circular', 'breakpoint']) {
    expect(help).toContain(`Usage: jb2export ${mode} [options]`)
  }
  expect(help).toContain('Usage: jb2export batch --sites <file> [options]')
  expect(help).toContain('--outDir')
})

test('subcommand help lists comparison track options', () => {
  const help = buildHelp('jb2export', trackTypes, syntenyTrackTypes, 'dotplot')
  expect(help).toContain('Usage: jb2export dotplot')
  expect(help).toContain('--view')
  expect(help).toContain('Comparison track options: --paf')
})

test('subcommand help lists only the options its view draws', () => {
  const dotplot = buildHelp(
    'jb2export',
    trackTypes,
    syntenyTrackTypes,
    'dotplot',
  )
  expect(dotplot).not.toContain('--loc ')
  expect(dotplot).not.toContain('--track ')
  expect(dotplot).not.toContain('--showGridlines')
  const lgv = buildHelp('jb2export', trackTypes, syntenyTrackTypes, 'linear')
  expect(lgv).toContain('--refseq')
  expect(lgv).toContain('--spec')
  expect(lgv).toContain('Track options: --bam')
})

test('an option its view does not draw is named, and one it does is not', () => {
  expect(optionsWithoutEffect('circular', ['loc', 'track', 'width'])).toEqual([
    'loc',
  ])
  expect(optionsWithoutEffect('synteny', ['loc', 'trackLabels'])).toEqual([
    'loc',
  ])
  expect(optionsWithoutEffect('linear', ['loc', 'refseq'])).toEqual([])
})

describe('batch options', () => {
  test('a count rejects a fraction or a negative rather than acting on it', () => {
    expect(getOptionalCount(parse('--limit 20'), 'limit')).toBe(20)
    expect(getOptionalCount(parse('--limit 0'), 'limit')).toBe(0)
    // `slice(0, -2)` renders all but the LAST two, silently
    // a negative flank inverts the window into a start-greater-than-end that
    // every record then fails on separately
    for (const bad of ['--limit=-2', '--flank=-500', '--limit 2.5']) {
      const key = bad.slice(2).split(/[= ]/)[0]!
      expect(() => getOptionalCount(parse(bad), key)).toThrow(
        `--${key} needs a whole number of 0 or more`,
      )
    }
  })

  test('an unknown --format is refused instead of quietly writing a PNG', () => {
    expect(getFormat(parse('--format svg'))).toBe('svg')
    expect(getFormat(parse('--format pdf'))).toBe('pdf')
    expect(() => getFormat(parse('--format jpg'))).toThrow(
      '--format takes one of png, svg, pdf, got "jpg"',
    )
  })

  test('batch help offers only what a batch can honor', () => {
    const help = buildBatchHelp('jb2export')
    for (const flag of ['--outDir', '--flank', '--limit', '--resume']) {
      expect(help).toContain(flag)
    }
    // --outDir replaces --out and the junction file replaces --loc; --spec and
    // --session fix the view, which in a batch is N identical images
    for (const name of ['out', 'loc', 'spec', 'session']) {
      expect(help).not.toMatch(new RegExp(`^  --${name}\\s`, 'm'))
    }
  })
})
