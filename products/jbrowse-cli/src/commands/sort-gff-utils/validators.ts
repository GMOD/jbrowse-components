import { sync as commandExistsSync } from 'command-exists'

export function validateFileArgument(file?: string): void {
  // Allow no file argument for stdin input
  if (!file && process.stdin.isTTY) {
    console.error('Error: Missing required argument: file')
    console.error('Usage: jbrowse sort-gff <file>')
    console.error(
      '       OR pipe data via stdin: cat file.gff | jbrowse sort-gff',
    )
    process.exit(1)
  }
}

export function validateRequiredCommands(): void {
  const requiredCommands = ['sh', 'sort', 'grep']
  const missingCommands = requiredCommands.filter(
    cmd => !commandExistsSync(cmd),
  )

  if (missingCommands.length > 0) {
    throw new Error(
      'Error: Unable to sort, requires unix type environment with sort, grep',
    )
  }
}
