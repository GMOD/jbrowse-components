import { sync as commandExistsSync } from 'command-exists'

export function validateFileArgument(file?: string): void {
  if (!file) {
    console.error('Error: Missing required argument: file')
    console.error('Usage: jbrowse sort-bed <file>')
    process.exit(1)
  }
}

export function validateRequiredCommands(): void {
  const requiredCommands = ['sh', 'sort', 'grep']
  const missingCommands = requiredCommands.filter(
    cmd => !commandExistsSync(cmd),
  )

  if (missingCommands.length > 0) {
    console.error(
      'Error: Unable to sort, requires unix type environment with sort, grep',
    )
    process.exit(1)
  }
}
