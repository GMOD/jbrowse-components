/**
 * Reports every read that RESOLVES a callback-capable config slot without
 * supplying a context for the callback, and fails when the count grows.
 *
 * `readConfObject` / `getConf` / `resolveConf` take `args` as an OPTIONAL third
 * parameter, so "what is this setting" and "what is this setting FOR this
 * feature" are the same call with and without it. On a slot holding a `jexl:`
 * expression the arg-less form still evaluates, against a context where every
 * name the expression mentions is `undefined`, and hands back the fallout as the
 * setting. Two shipped bugs wore the two symptoms of that and looked nothing
 * alike: `get(feature,…)` threw `reading 'get'` out of a display getter, and
 * `split(feature.name,…)` returned `''` because `split` is total, which shipped
 * to the worker as an attribute name and drew every feature in one unnamed row.
 *
 * The fix at a call site is to decide which of the two operations it wants
 * (adr-066):
 *
 *   - forwarding the slot to a worker that will bind the feature — read it RAW,
 *     `self.conf.someSlot`, no reader involved;
 *   - using it as a value here — pass the feature in `args`, or guard with
 *     `isJexl` and fall back, the way a color swatch does.
 *
 * This cannot be a type error. For a `color` or `string` slot the resolved type
 * is already `string` and a `jexl:` expression IS a string, so nothing widens
 * and there is nothing for tsc to catch; `featureHeight: number` is the only
 * shape where the type moves at all. It cannot be a runtime guard in the reader
 * either — an arg-less read is the correct, common operation on every slot that
 * holds no callback, and `@jbrowse/core/configuration` is on the plugin ABI, so
 * changing what such a read returns changes it for third-party code that never
 * opted in (adr-066 records that attempt and why it was backed out).
 *
 * So it is a lint, in the shape the config-read audit next door already
 * established: a committed baseline that fails when it GROWS, rather than a
 * `console.warn` that scrolls past in a CI log.
 *
 * Precision, and it is deliberately partial. The callback-capable slot set is
 * derived from the schema sources — any slot definition declaring
 * `contextVariable`, which is what gates `SlotEditor`'s value/callback toggle —
 * but a read is matched on the slot NAME alone. Resolving it per-schema would
 * need the reader's config node traced back to its `ConfigurationSchema(...)`
 * literal, which the checker will not do through a widened holder (the same wall
 * documented in audit-config-read-types.ts).
 *
 * So a name only counts when EVERY slot bearing it is callback-capable. Eight
 * are not — `color`, `name`, `description`, `featureHeight`, `label`,
 * `mouseover`, `size`, `thickness` all also exist as ordinary value slots on
 * unrelated schemas, with dozens of legitimate arg-less reads between them.
 * Including them produced 32 findings of which 2 were real, and a check with
 * that signal-to-noise is one somebody turns off. They are excluded and NAMED in
 * the baseline header rather than dropped silently, because `color` being
 * uncovered is a genuine hole: it is the most common callback slot there is.
 * What stands in for the check there is a canary test at the call site.
 *
 * Run: `pnpm check-deferred-slot-reads` (or
 * `node scripts/audit-deferred-slot-reads.ts --write` to re-baseline).
 */
import fs from 'node:fs'
import path from 'node:path'

import ts from 'typescript'

const REPO_ROOT = path.join(import.meta.dirname, '..')
const BASELINE = path.join(import.meta.dirname, 'deferredSlotReads.txt')

const READERS = new Set(['getConf', 'resolveConf', 'readConfObject'])

interface Read {
  file: string
  line: number
  callee: string
  slot: string
}

function createProgram() {
  const configPath = path.join(REPO_ROOT, 'tsconfig.json')
  const read = ts.readConfigFile(configPath, f => ts.sys.readFile(f))
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, REPO_ROOT)
  const program = ts.createProgram(parsed.fileNames, parsed.options)
  const roots = new Set(parsed.fileNames.map(f => path.resolve(f)))
  return program
    .getSourceFiles()
    .filter(sf => !sf.isDeclarationFile && roots.has(path.resolve(sf.fileName)))
}

// Every slot name whose definition declares `contextVariable`, i.e. every slot
// the config editor will offer a callback toggle for. Read off the definition
// literal rather than a hand-maintained list, so a slot that gains the
// declaration is covered without anyone remembering this file exists.
function callbackCapableSlots(sources: ts.SourceFile[]) {
  const withContext = new Map<string, string[]>()
  const withoutContext = new Set<string>()
  for (const sf of sources) {
    // Matched top-down as `slotName: { … contextVariable … }` rather than by
    // walking up from the `contextVariable` property: `ts.createProgram` does
    // not set `parent` pointers, and asking for them costs a re-parse.
    const visit = (node: ts.Node): void => {
      if (
        ts.isPropertyAssignment(node) &&
        ts.isIdentifier(node.name) &&
        ts.isObjectLiteralExpression(node.initializer)
      ) {
        const props = node.initializer.properties.filter(p =>
          ts.isPropertyAssignment(p),
        )
        const named = (n: string) =>
          props.some(p => ts.isIdentifier(p.name) && p.name.text === n)
        // `type` + `defaultValue` is what distinguishes a slot definition from a
        // nested sub-schema or any other object literal in these files
        if (named('type') && named('defaultValue')) {
          if (named('contextVariable')) {
            const file = path.relative(REPO_ROOT, sf.fileName)
            const list = withContext.get(node.name.text)
            if (list) {
              list.push(file)
            } else {
              withContext.set(node.name.text, [file])
            }
          } else {
            withoutContext.add(node.name.text)
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }

  // A name is only usable as a signal when EVERY slot that bears it is
  // callback-capable. `name`, `description`, `color` and `featureHeight` each
  // exist on unrelated schemas as ordinary values — a track's `name`, a wiggle's
  // per-signal `color` — and there are dozens of legitimate arg-less reads of
  // those. Including them buries the real finding under noise, and a check
  // nobody can act on is a check someone turns off. Reported as uncovered
  // rather than silently dropped, because that is a real hole in this gate:
  // adr-066 names the two canary tests that stand in for it, at the two call
  // sites where it mattered.
  const ambiguous = [...withContext.keys()]
    .filter(n => withoutContext.has(n))
    .sort()
  for (const n of ambiguous) {
    withContext.delete(n)
  }
  return { slots: withContext, ambiguous }
}

function isTest(file: string) {
  return /\.test\.tsx?$|[/\\]tests?[/\\]|testEnv\.ts$|testUtils\.ts$/.test(file)
}

function main() {
  const write = process.argv.includes('--write')
  const sources = createProgram()
  const { slots, ambiguous } = callbackCapableSlots(sources)
  const found: Read[] = []

  for (const sf of sources) {
    if (sf.fileName.includes('/node_modules/') || isTest(sf.fileName)) {
      continue
    }
    const visit = (node: ts.Node): void => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        READERS.has(node.expression.text)
      ) {
        const slotArg = node.arguments[1]
        // an arg-less read: config node + slot name and nothing else. A third
        // argument is the call saying what the callback is about, which is the
        // spelling this check exists to ask for.
        if (
          slotArg &&
          ts.isStringLiteral(slotArg) &&
          node.arguments.length === 2 &&
          slots.has(slotArg.text)
        ) {
          // `getStart(sf)` explicitly: no type checker is created here, so
          // nothing has bound the source files and `parent` pointers are unset,
          // which is what the no-argument overload walks to find the file.
          const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
          found.push({
            file: path.relative(REPO_ROOT, sf.fileName),
            line: line + 1,
            callee: node.expression.text,
            slot: slotArg.text,
          })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }

  found.sort((a, b) =>
    a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file),
  )

  const lines = [
    '# Arg-less reads of a callback-capable config slot.',
    '#',
    '# Generated by `node scripts/audit-deferred-slot-reads.ts --write`.',
    '# Each entry resolves a slot that may hold a `jexl:` expression without',
    '# giving the expression anything to be about, so a configured callback is',
    '# evaluated against a context where every name in it is undefined. See',
    '# adr-066 and CONFIG_PATTERN.md §"Forwarding a callback slot".',
    '#',
    '# Reads are matched on the slot NAME, so a name is only usable as a signal',
    '# when every slot bearing it is callback-capable. These names are not, and',
    '# are therefore NOT covered by this gate — each also exists as an ordinary',
    '# value slot on an unrelated schema (a track `name`, a wiggle `color`), with',
    '# many legitimate arg-less reads:',
    '#',
    ...ambiguous.map(n => `#   ${n}`),
    '#',
    '# That is a real hole, not a rounding error: `color` is both the most common',
    '# callback slot and one of the uncovered names. The two call sites where it',
    '# bit are pinned by canaries instead (colorSlotTransport.test.ts,',
    '# partitionFieldTransport.test.ts). Closing it needs each read traced to its',
    '# own schema, which the checker will not do through a widened holder — the',
    '# same wall audit-config-read-types.ts documents.',
    '#',
    `# ${found.length} arg-less reads of callback-capable slot names.`,
    '',
    ...found.map(r => `${r.file}\t${r.line}\t${r.callee}('${r.slot}')`),
  ]
  const body = `${lines.join('\n')}\n`

  if (write) {
    fs.writeFileSync(BASELINE, body)
    console.log(
      `wrote ${BASELINE}: ${found.length} arg-less reads of ${slots.size} callback-capable slot names`,
    )
    return 0
  }

  const previous = fs.existsSync(BASELINE)
    ? fs.readFileSync(BASELINE, 'utf8')
    : ''
  const prevCount = Number(
    /# (\d+) arg-less reads/.exec(previous)?.[1] ?? Number.POSITIVE_INFINITY,
  )
  console.log(
    `${found.length} arg-less reads of ${slots.size} callback-capable slot names`,
  )
  if (found.length > prevCount) {
    console.error(
      `\nArg-less reads of callback-capable slots grew from ${prevCount} to ${found.length}.\n` +
        `A call site resolves a slot that may hold a jexl callback without giving\n` +
        `the callback a feature. If the value is being forwarded to a worker, read\n` +
        `the slot raw (self.conf.someSlot); if it is used here, pass the feature in\n` +
        `args or guard with isJexl. See adr-066. Re-baselining is for a genuine\n` +
        `same-name-different-schema collision only — say which in the commit.`,
    )
    return 1
  }
  if (found.length < prevCount) {
    console.log(
      `Improved (${prevCount} -> ${found.length}); re-run with --write to lower the baseline.`,
    )
  }
  return 0
}

process.exitCode = main()
