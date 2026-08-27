/* eslint no-cond-assign: ["error", "except-parens"] */
import getValue from './get-value.ts'
import setValue from './set-value.ts'

import type { Config } from './types.ts'

/**
 * Parse a JBrowse 1 config file. A `trackList.json` is JSON; a `tracks.conf`
 * is JBrowse 1's own INI-like format, whose `[section.subsection]` headers and
 * `key.subkey = value` lines both address a dotted path.
 */
export function parseJb1(text: string, url = ''): Config {
  if (text.trimStart().startsWith('{')) {
    try {
      return JSON.parse(text)
    } catch (error) {
      throw new Error(`${error} when parsing ${url || 'configuration'}`, {
        cause: error,
      })
    }
  }
  return parseConf(text, url)
}

function parseConf(text: string, url: string): Config {
  let section: string[] = []
  let keyPath: string[] | undefined
  let operation: string
  let value: string | undefined
  const data: Config = { tracks: {} }
  let lineNumber: number

  function recordVal(): void {
    if (value !== undefined) {
      let parsedValue: string | number | boolean | unknown[]
      try {
        const match = /^json:(.+)/i.exec(value)
        if (match) {
          parsedValue = JSON.parse(match[1]!)
        } else if (/^[+-]?[\d.,]+([eE][-+]?\d+)?$/.test(value)) {
          parsedValue = Number.parseFloat(value.replaceAll(',', ''))
        } else {
          parsedValue = value
        }

        if (!keyPath) {
          throw new Error(`Error parsing in section ${section.join(' - ')}`)
        }
        const path = [...section, ...keyPath].join('.')
        if (operation === '+=') {
          const prev = getValue(data, path)
          const existing: unknown[] = Array.isArray(prev)
            ? prev
            : prev
              ? [prev]
              : []
          existing.push(parsedValue)
          parsedValue = existing
        }
        if (parsedValue === 'true') {
          parsedValue = true
        }
        if (parsedValue === 'false') {
          parsedValue = false
        }
        setValue(data, path, parsedValue)
      } catch (e) {
        throw new Error(
          `syntax error${url ? ` in ${url}` : ''}${
            lineNumber ? ` at line ${lineNumber - 1}` : ''
          }`,
          { cause: e },
        )
      }
    }
  }

  for (const [i, textLine] of text.split(/\n|\r\n|\r/).entries()) {
    lineNumber = i + 1
    const line = textLine.replace(/^\s*#.+/, '')

    let match: RegExpMatchArray | null
    if ((match = /^\s*\[([^\]]+)/.exec(line))) {
      recordVal()
      keyPath = undefined
      value = undefined
      section = match[1]!.trim().split(/\s*\.\s*/)
      if (section.length === 1 && section[0]!.toLowerCase() === 'general') {
        section = []
      }
    } else if (
      (match = line.match(
        value === undefined ? /^([^+=]+)(\+?=)(.*)/ : /^(\S[^+=]+)(\+?=)(.*)/,
      ))
    ) {
      recordVal()
      keyPath = match[1]!.trim().split(/\s*\.\s*/)
      operation = match[2]!
      if ([...section, ...keyPath].join('.') === 'include') {
        operation = '+='
      }
      value = match[3]!.trim()
    } else if (
      keyPath !== undefined &&
      (match = /^\s{0,4}\+\s*(.+)/.exec(line))
    ) {
      recordVal()
      operation = '+='
      value = match[1]!.trim()
    } else if (value !== undefined && (match = /^\s+(\S.*)/.exec(line))) {
      const m = match[1]!
      value += value.length ? ` ${m.trim()}` : m.trim()
    } else {
      recordVal()
      keyPath = undefined
      value = undefined
    }
  }

  recordVal()

  return data
}
