import { parseArgs } from 'node:util'

import { printHelp, readConfigFile } from '../../utils.ts'
import { validateConfig } from './validateConfig.ts'

import type { Problem } from './types.ts'

const description =
  'Check a JBrowse configuration for errors, including the ones JBrowse itself accepts silently'

const notes = `A config key JBrowse does not recognize is ignored rather than reported, so a
misspelled slot leaves the track loading normally with the setting doing
nothing. That is what this command is mainly for.

Two levels are reported:

  error    JBrowse accepts it and silently does the wrong thing — an unknown
           slot, a key a defaultSession view or display does not declare, a
           track naming an assembly the config never defines, a defaultSession
           naming a trackId that does not exist, a duplicate trackId. Exits 1.

  warning  JBrowse will complain by itself on load, or handles it — a type name
           the core plugins do not register (expected if one of your plugins
           registers it), or a legacy key a migration rewrites, such as a view
           nesting its settings under "init". Never fails the run.

Types registered by plugins are not known to this command, so they come through
as warnings rather than errors.`

const examples = [
  '# check the config.json in the current directory',
  '$ jbrowse validate',
  '',
  '# check a specific config or saved session',
  '$ jbrowse validate /path/to/config.json',
  '$ jbrowse validate mysession.jbrowse',
  '',
  '# machine-readable output',
  '$ jbrowse validate config.json --json',
]

const options = {
  json: {
    type: 'boolean',
    description: 'Output the findings as JSON instead of text',
  },
  quiet: {
    type: 'boolean',
    short: 'q',
    description: 'Only print errors, suppressing warnings and notes',
  },
  help: { type: 'boolean', short: 'h', description: 'Show help' },
} as const

function format({ level, where, message }: Problem) {
  return where ? `${level}: ${where}: ${message}` : `${level}: ${message}`
}

export async function run(args?: string[]) {
  const { values: flags, positionals } = parseArgs({
    options,
    args,
    allowPositionals: true,
  })
  if (flags.help) {
    printHelp({
      description,
      examples,
      notes,
      usage: 'jbrowse validate [config.json] [options]',
      options,
    })
    return
  }

  const file = positionals[0] ?? 'config.json'
  // readConfigFile, not readJsonFile: running from the wrong directory is the
  // most common way this fails, and it says which path it looked at.
  const config = await readConfigFile<unknown>(file)
  const result = validateConfig(config)

  if (flags.json) {
    console.log(
      JSON.stringify({ file, ok: result.errorCount === 0, ...result }, null, 2),
    )
  } else {
    const shown = flags.quiet
      ? result.problems.filter(p => p.level === 'error')
      : result.problems
    if (!flags.quiet) {
      for (const note of result.notes) {
        console.log(`note: ${note}`)
      }
    }
    for (const problem of shown) {
      console.log(format(problem))
    }
    if (result.problems.length === 0) {
      console.log(`${file} looks good`)
    } else {
      console.log(
        `\n${result.errorCount} error(s), ${result.warningCount} warning(s) in ${file}`,
      )
    }
  }

  if (result.errorCount > 0) {
    // Non-zero so this can gate a deploy. Thrown rather than process.exit so it
    // goes through the same error path as every other command.
    throw new Error(
      `${result.errorCount} error(s) found in ${file}`,
      // no cause: the findings are already printed above
    )
  }
}
