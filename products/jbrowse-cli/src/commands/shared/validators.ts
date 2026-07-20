import { execFileSync } from 'node:child_process'
import { accessSync, constants, statSync } from 'node:fs'

export function validateFileArgument(
  file: string | undefined,
  commandName: string,
  fileType: string,
): void {
  if (file) {
    // The sort pipeline's exit status is `sort`'s, which succeeds on empty
    // input, so a missing/unreadable file would otherwise "succeed" with empty
    // output. Fail loudly here instead.
    if (!statSync(file, { throwIfNoEntry: false })?.isFile()) {
      throw new Error(
        `Input file does not exist or is not a regular file: ${file}`,
      )
    }
    try {
      accessSync(file, constants.R_OK)
    } catch {
      throw new Error(`Input file is not readable: ${file}`)
    }
  } else if (process.stdin.isTTY) {
    throw new Error(
      `Missing required argument: file\n` +
        `Usage: jbrowse ${commandName} <file>\n` +
        `       OR pipe data via stdin: cat file.${fileType} | jbrowse ${commandName}`,
    )
  }
}

// Replaces command-exists: is `command` runnable? On POSIX, `command -v` (a
// shell builtin, so invoked via `sh`) resolves builtins, PATH entries, and
// absolute paths; on Windows, `where` does the same. The name is passed as an
// argv item, never interpolated into the shell, so it can't be injected.
function commandExistsSync(command: string): boolean {
  try {
    if (process.platform === 'win32') {
      execFileSync('where', [command], { stdio: 'ignore' })
    } else {
      execFileSync('sh', ['-c', 'command -v "$1"', 'sh', command], {
        stdio: 'ignore',
      })
    }
    return true
  } catch {
    return false
  }
}

export function validateRequiredCommands(requiredCommands: string[]): void {
  const missingCommands = requiredCommands.filter(
    cmd => !commandExistsSync(cmd),
  )

  if (missingCommands.length > 0) {
    throw new Error(
      `Unable to run command, requires a unix type environment with the following available: ${requiredCommands.join(', ')}. Missing: ${missingCommands.join(', ')}`,
    )
  }
}
