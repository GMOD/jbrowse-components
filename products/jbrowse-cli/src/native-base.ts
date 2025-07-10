export function printHelp({
  description,
  options,
  examples,
  usage,
  log,
}: {
  description: string
  options: Record<string, unknown>
  examples: string[]
  usage?: string
  log: (message: string) => void
}) {
  log(description)
  log(`\nUsage: ${usage || 'jbrowse <command> [options]'}`)
  log('\nOptions:')
  for (const [name, option] of Object.entries(options)) {
    const short =
      'short' in (option as any) && (option as any).short
        ? `-${(option as any).short},`
        : '   '
    const namePadded = `--${name}`.padEnd(25, ' ')
    const desc = (option as any).description?.replace(
      /\n/g,
      `\n${' '.repeat(29)}`,
    )
    log(`  ${short} ${namePadded} ${desc}`)
  }
  log(`\n${examples.join('\n')}`)
}
