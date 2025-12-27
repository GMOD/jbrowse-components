import { sync as commandExistsSync } from 'command-exists'

export function validateFileArgument(
  file: string | undefined,
  commandName: string,
  fileType: string,
): void {
  if (!file && process.stdin.isTTY) {
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
      `Unable to run command, requires unix type environment with: ${requiredCommands.join(', ')}`,
    )
  }
}
