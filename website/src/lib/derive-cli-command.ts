// Shared helpers for deriving a `jbrowse` command from a config object, used by
// derive-add-track.ts and derive-add-assembly.ts. Both return an argv array
// rather than a shell string, so the check scripts can run the real CLI without
// re-parsing quoting, and `formatCommand` renders that argv for the docs.

export function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {}
}

// A non-empty string, or undefined — so callers can test presence by truthiness.
export function nonEmpty(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

// A comma list for a repeatable flag, or undefined when there's nothing to pass.
export function commaList(value: unknown) {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmpty)
    ? value.join(',')
    : undefined
}

// `flag value` when `value` is set, nothing when it isn't.
export function flag(name: string, value: string | undefined) {
  return value === undefined ? [] : [name, value]
}

// `flag value` once per entry, for a repeatable flag like --alias.
export function repeatedFlag(name: string, values: unknown) {
  return Array.isArray(values)
    ? values.flatMap(v => flag(name, nonEmpty(v)))
    : []
}

// local paths need --load; URLs are referenced in place
export function loadFlag(file: string) {
  return flag('--load', /^\w+:\/\//.test(file) ? undefined : 'copy')
}

// Quote a token for a POSIX shell only when it carries a shell-significant
// character; plain tokens (ids, URLs, comma lists) stay bare. An inline-JSON
// value (--config, --displayDefaults) takes single quotes so it reads as the
// CLI's own examples write it, rather than as a wall of backslashes; a value
// carrying both quote characters (a jexl callback) still needs the escaped
// double-quoted form.
function shellArg(value: string) {
  return /^[A-Za-z0-9_./:,=@+-]+$/.test(value)
    ? value
    : value.includes('"') && !value.includes("'")
      ? `'${value}'`
      : `"${value.replaceAll(/(["\\$`])/g, '\\$1')}"`
}

// Render an argv as a readable multi-line shell command: the positional file on
// the first line, then one `--flag value` pair per continued line.
export function formatCommand(args: string[]) {
  const [subcommand = '', uri = '', ...flags] = args
  const pairs = flags.flatMap((token, i) =>
    i % 2 === 0 ? [`${token} ${shellArg(flags[i + 1] ?? '')}`] : [],
  )
  return [`jbrowse ${subcommand} ${shellArg(uri)}`, ...pairs].join(' \\\n  ')
}
