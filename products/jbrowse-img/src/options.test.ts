import { syntenyTrackTypes, trackTypes } from './makeConfigs.ts'
import {
  buildHelp,
  getBoolean,
  getBooleanValue,
  getCigarMode,
  getNumber,
  getString,
  getThemeName,
  getTrackLabels,
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
  expect(getTrackLabels(parse('--trackLabels offset'))).toBe('offset')
  expect(getTrackLabels(parse('--trackLabels bogus'))).toBeUndefined()
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
