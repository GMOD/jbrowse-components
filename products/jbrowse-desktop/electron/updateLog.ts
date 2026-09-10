import fs from 'node:fs'

import type { Logger } from 'electron-updater'

// Generous for what electron-updater writes — a handful of lines per check — so
// the file holds months, and small enough that a user can attach it to an issue.
const MAX_BYTES = 256 * 1024

function timestamp() {
  return new Date().toISOString()
}

function format(value: unknown) {
  return value instanceof Error ? (value.stack ?? value.message) : String(value)
}

/**
 * electron-updater's logger, written to a file as well as the console. Its
 * default is `console`, and a packaged app has no terminal, so an update that
 * failed on someone's machine left nothing to ask them for.
 *
 * Appends across launches, because applying an update quits and relaunches:
 * truncating on startup would erase the install being investigated. It rotates
 * instead, keeping one previous window in `<path>.old`. Every write is guarded —
 * a log that cannot be written must not be why an update fails.
 */
export function createUpdateLog(logPath: string): Required<Logger> {
  rotate(logPath)
  const record = (level: string, value: unknown) => {
    try {
      fs.appendFileSync(
        logPath,
        `${timestamp()} ${level} ${format(value)}\n`,
        'utf8',
      )
    } catch {
      // the console half below is what is left
    }
  }
  return {
    info: (value: unknown) => {
      console.log(value)
      record('info', value)
    },
    warn: (value: unknown) => {
      console.warn(value)
      record('warn', value)
    },
    error: (value: unknown) => {
      console.error(value)
      record('error', value)
    },
    debug: (value: unknown) => {
      record('debug', value)
    },
  }
}

function rotate(logPath: string) {
  try {
    if (fs.statSync(logPath).size > MAX_BYTES) {
      fs.renameSync(logPath, `${logPath}.old`)
    }
  } catch {
    // no log yet, or nowhere to put one
  }
}
