import { accessSync, constants, statSync } from 'node:fs'

import { sync as commandExistsSync } from 'command-exists'

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
