import { sync as commandExistsSync } from 'command-exists'

export function validateFileArgument(file?: string): void {
  // Allow no file argument for stdin input
  if (!file && process.stdin.isTTY) {
    console.error('Error: Missing required argument: file')
    console.error('Usage: jbrowse make-pif <file> [options]')
    console.error(
      '       OR pipe data via stdin: cat file.paf | jbrowse make-pif',
    )
    process.exit(1)
  }
}

export function validateRequiredCommands(): void {
  const requiredCommands = ['sh', 'sort', 'grep', 'tabix', 'bgzip']
  const missingCommands = requiredCommands.filter(
    cmd => !commandExistsSync(cmd),
  )

  if (missingCommands.length > 0) {
    console.error(
      'Error: Unable to sort, requires unix type environment with sort, grep, bgzip, tabix',
    )
    process.exit(1)
  }
}
