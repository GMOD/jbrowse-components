import type { RExportInvocation } from './rexportCommand.ts'

// Render one gallery figure's jb2export invocation as a pasteable shell block.
//
// Pure, and split from rexportCommand.ts for that reason: looking an invocation
// up needs the whole spec registry, which reaches puppeteer through
// screenshot-specs and so cannot be loaded by Jest's CJS transform. The shell
// quoting is the part with rules worth pinning, so it lives where a test can
// reach it. Same split, same reason, as jbrowse-img's comparativeInit.ts.

// `--spec` takes inline JSON as happily as a path (see parseSpec), and inline is
// what makes the line pasteable — the alternative is telling the reader to save
// a file first.
export function shellSingleQuote(s: string) {
  return `'${s.replaceAll("'", `'\\''`)}'`
}

// The spec's own extra argv, regrouped one flag per line: `['--track', 'id',
// '{json}']` reads as `--track id '{json}'`. A value that needs no quoting keeps
// none, so the display state a figure adds stays legible.
export function renderExtraArgs(args: string[]) {
  const lines: string[] = []
  for (const arg of args) {
    if (arg.startsWith('--') || lines.length === 0) {
      lines.push(`  ${arg}`)
    } else {
      lines[lines.length - 1] +=
        ` ${/^[\w.:/-]+$/.test(arg) ? arg : shellSingleQuote(arg)}`
    }
  }
  return lines
}

/**
 * The `### name` + fenced bash block for one figure. `name` is the figure's
 * basename, which is also what the emitted script's own ggsave() is retargeted
 * at during a sweep, so the `.R` and the `.png` share it.
 */
export function rExportCommandBlock(
  name: string,
  { configUrl, sessionSpec, extraArgs }: RExportInvocation,
) {
  const lines = [
    'jb2export \\',
    `  --config ${configUrl} \\`,
    // compacted onto one line; the specs run 100-500 characters
    `  --spec ${shellSingleQuote(JSON.stringify(JSON.parse(sessionSpec)))} \\`,
    ...renderExtraArgs(extraArgs).map(l => `${l} \\`),
    `  --out ${name}.R`,
    `Rscript ${name}.R`,
  ]
  return `### ${name}\n\n\`\`\`bash\n${lines.join('\n')}\n\`\`\``
}
