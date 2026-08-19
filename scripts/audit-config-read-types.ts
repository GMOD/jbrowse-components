/**
 * Reports every config read/write whose TYPE CHECKING IS OFF, and fails when the
 * count grows.
 *
 * `getConf` / `resolveConf` / `setConf` derive both halves of their safety from
 * the schema attached to `model.configuration`:
 *
 *   - the **slot name** is constrained to `ConfigurationSlotName<Schema>`, a
 *     finite union of literals, so a typo is a compile error;
 *   - the **value type** comes from `ConfigurationSlotValue<Schema, Slot>`.
 *
 * What this number is now worth, post-adr-052: the WRITE path is guarded at
 * runtime regardless of the schema — `setSlot` throws on an undeclared slot
 * name, and MST type-checks the assigned value — so what these gaps uniquely
 * cost is a typo'd slot name on a READ, which returns the default silently. The
 * read path cannot take the same runtime guard (reading off an un-hydrated
 * frozen config is legitimate and indistinguishable from the broken spelling;
 * tried and reverted, see CONFIG_PATTERN.md).
 *
 * Both collapse the moment the schema widens to `AnyConfigurationSchemaType` —
 * `ConfigurationSlotName` degrades to `never`/`string` and the value to `any`.
 * The mixin cast (`confNode(self)`, `host(self)`) used to be the largest source
 * of that and is no longer any of it: a mixin cannot see the composing display's
 * schema, but it can name the slots it owns (`ConfigModelForFields`) or the base
 * schema a base slot lives on, and `HostChecksSlotNames` fails the build if one
 * widens back. What is left is the three populations the baseline header names.
 *
 * `configTypeNarrowing.test.ts` guards that the machinery narrows correctly on a
 * concrete schema. This is the other half: how many real call sites reach it.
 *
 * Committed as a baseline rather than a `console.warn`, for the reason the
 * api-docs gap files already state: a warning fails nothing and scrolls past in
 * a CI log.
 *
 * Run: `pnpm check-config-read-types` (or `node scripts/audit-config-read-types.ts
 * [--write]` to re-baseline).
 *
 * Gated in CI, as a step on the `typecheck` job in push.yml — it builds a program
 * from the same root tsconfig, so it wants that job's checkout and toolchain. It
 * spent a while as a script nothing ran, which is how the baseline came to sit 5
 * behind the tree with nobody noticing; the gate language below was aspirational
 * until then and is now literal.
 */
import fs from 'node:fs'
import path from 'node:path'

import ts from 'typescript'

const REPO_ROOT = path.join(import.meta.dirname, '..')
const BASELINE = path.join(import.meta.dirname, 'configReadTypeGaps.txt')

// Build the program from the root tsconfig rather than importing the api-docs
// helper: that module lives under a looser tsconfig, and importing it drags it
// into the strict program where it doesn't compile. Parsing the config here also
// means this audit sees exactly the file set `pnpm typecheck` does, which is the
// set whose types we are making claims about.
function createProgram() {
  const configPath = path.join(REPO_ROOT, 'tsconfig.json')
  const read = ts.readConfigFile(configPath, f => ts.sys.readFile(f))
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, REPO_ROOT)
  const program = ts.createProgram(parsed.fileNames, parsed.options)
  const roots = new Set(parsed.fileNames.map(f => path.resolve(f)))
  return {
    program,
    sources: program
      .getSourceFiles()
      .filter(
        sf => !sf.isDeclarationFile && roots.has(path.resolve(sf.fileName)),
      ),
  }
}

// The four config accessors. `readConfObject` takes a config node directly
// rather than a model with `.configuration`; it is otherwise held to the same
// standard and its source-bucket gaps DO count toward the gate. It used to have a
// model-shaped loose overload that laundered any typo into `any`, which is gone —
// the remaining loose path is an ARRAY slot path, and those never reach this list
// because only string-literal slot args are recorded (see `isLiteralSlot`).
const READERS = new Set(['getConf', 'resolveConf', 'readConfObject'])
const WRITERS = new Set(['setConf'])

type Bucket = 'source' | 'test'

interface Gap {
  file: string
  line: number
  callee: string
  slot: string
  bucket: Bucket
}

// Test fixtures build configs by hand off `ConfigurationSchema(...)` locals or
// read through `AnyConfigurationModel` on purpose; they are listed for
// completeness but kept out of the gate, because tightening them buys no
// production safety and would only push people toward casts.
function bucketFor(file: string): Bucket {
  return /\.test\.tsx?$|[/\\]tests?[/\\]|testEnv\.ts$|testUtils\.ts$/.test(file)
    ? 'test'
    : 'source'
}

// Whether this read reached a concrete schema.
//
// Two signals don't work, and both are worth naming so they aren't retried. The
// *parameter* type is useless: `SLOT` is inferred from the string literal you
// passed, so the instantiated parameter is always that literal even when the
// constraint behind it is a bare `string`. The *config node* type is nearly as
// bad: `AnyConfigurationModel` is a real object type, not `any`, so a widened
// holder looks concrete while `ConfigurationSlotName` of it has already degraded
// to `string` and admits any name — verified with a `@ts-expect-error` probe on
// the mixin idiom, which compiled clean.
//
// The honest signal is the read's own return type. `ConfigurationSlotValue`
// bottoms out at `any` for exactly the widened case, which is the same thing
// `configTypeNarrowing.test.ts` asserts against with its `Equal<T, any>` check.
// Slot name and value type widen together, so this catches both.
function readIsChecked(type: ts.Type) {
  return (type.flags & ts.TypeFlags.Any) === 0
}

function main() {
  const write = process.argv.includes('--write')
  const gaps: Gap[] = []
  let total = 0

  {
    const { program, sources } = createProgram()
    const checker = program.getTypeChecker()

    for (const sf of sources) {
      if (sf.fileName.includes('/node_modules/')) {
        continue
      }
      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
          const callee = node.expression.text
          const isRead = READERS.has(callee)
          if (isRead || WRITERS.has(callee)) {
            total++
            const slotArg = node.arguments[1]
            // a dynamic or array-path slot is out of scope: the loose overload
            // is deliberate there (config editor slot facade, nested paths)
            const isLiteralSlot = slotArg && ts.isStringLiteral(slotArg)
            const slot = isLiteralSlot ? slotArg.text : '<dynamic>'
            const { line } = sf.getLineAndCharacterOfPosition(node.getStart())
            const file = path.relative(process.cwd(), sf.fileName)

            // Only the readers carry a signal. `setConf` returns void, so
            // there is nothing to inspect — but it widens with its siblings (the
            // constraint is the same `ConfigurationSlotName`), so a holder whose
            // reads are unchecked has unchecked writes too, and the reads are
            // what this counts.
            if (isLiteralSlot && isRead) {
              if (!readIsChecked(checker.getTypeAtLocation(node))) {
                gaps.push({
                  file,
                  line: line + 1,
                  callee,
                  slot,
                  bucket: bucketFor(file),
                })
              }
            }
          }
        }
        ts.forEachChild(node, visit)
      }
      visit(sf)
    }

    gaps.sort((a, b) =>
      a.file === b.file ? a.line - b.line : a.file.localeCompare(b.file),
    )

    const byFile = new Map<string, Gap[]>()
    for (const g of gaps) {
      const list = byFile.get(g.file)
      if (list) {
        list.push(g)
      } else {
        byFile.set(g.file, [g])
      }
    }

    const sourceGaps = gaps.filter(g => g.bucket === 'source')
    const lines = [
      '# Config reads whose slot name and value type are NOT checked.',
      '#',
      '# Generated by `node scripts/audit-config-read-types.ts --write`.',
      '# Each entry is a read that returned `any`, which happens exactly when the',
      '# schema behind it widened to AnyConfigurationSchemaType. Both halves go at',
      '# once: the value is `any`, AND `ConfigurationSlotName` degrades to `string`',
      '# so a typo in the quoted slot name compiles.',
      '#',
      '# What that costs, post-adr-052: a typo on a READ, which silently returns',
      '# the default. Writes are guarded at runtime whatever the schema — setSlot',
      '# throws on an undeclared name and MST type-checks the value — and the read',
      '# path cannot take the same guard (see adr-052).',
      '#',
      '# Four populations, and they want different things:',
      '#',
      '#   - a MIXIN casting its own `self` to a widened config holder. **No longer',
      '#     accepted, and no longer here**: a mixin names its own field table',
      '#     (`ConfigModelForFields`) or, for a base slot, the base schema, and',
      '#     `HostChecksSlotNames` pins each one. Ten mixins came off this list that',
      '#     way. What does NOT work is threading a type parameter — a generic body',
      '#     is checked against the constraint, so however narrow the default is the',
      '#     typo still compiles. Generating per-display accessors is still rejected',
      '#     (adr-052); naming the table is not that.',
      '#   - a `frozen`/`maybeFrozen` slot, which is `any` BY DESIGN — the escape',
      '#     hatch for arbitrary JSON. Accepted; it will never leave this list.',
      '#   - a read against a TRACK schema (`trackId`, `assemblyNames`, `adapter`,',
      '#     often via getContainingTrack/parentTrack). Grouped under the display',
      '#     file that happens to contain it, so it LOOKS like display debt; naming',
      "#     the display factory's schema cannot reach it. Check before estimating.",
      '#   - a factory that left its `configSchema` param at AnyConfigurationSchemaType.',
      '#     Usually one line, unless its base schema is itself widened — a base',
      '#     taken from `pluginManager.getDisplayType(…).configSchema` poisons the',
      '#     whole schema through GetBase and has to be re-plumbed first.',
      '#',
      `# ${sourceGaps.length} unchecked in source, ${gaps.length - sourceGaps.length} in tests,`,
      `# of ${total} total config accessor calls. The gate counts source only.`,
      '',
      ...[...byFile].flatMap(([file, list]) => [
        `${file}  (${list.length})${list[0]!.bucket === 'test' ? '  [test]' : ''}`,
        ...list.map(g => `  ${g.line}\t${g.callee}('${g.slot}')`),
      ]),
    ]
    const body = `${lines.join('\n')}\n`

    if (write) {
      fs.writeFileSync(BASELINE, body)
      // both counts, labelled: the gate compares the SOURCE number, so printing a
      // bare source+test total here is what made a 5-site drift read as a 178-site
      // one in the failure message below
      console.log(
        `wrote ${BASELINE}: ${sourceGaps.length} unchecked in source (+${gaps.length - sourceGaps.length} in tests) of ${total} calls`,
      )
      return 0
    }

    const previous = fs.existsSync(BASELINE)
      ? fs.readFileSync(BASELINE, 'utf8')
      : ''
    const prevCount = Number(
      /# (\d+) unchecked in source/.exec(previous)?.[1] ??
        Number.POSITIVE_INFINITY,
    )
    console.log(
      `${sourceGaps.length} unchecked in source (+${gaps.length - sourceGaps.length} in tests) of ${total} config accessor calls`,
    )
    if (sourceGaps.length > prevCount) {
      console.error(
        `\nUnchecked config slot names grew from ${prevCount} to ${sourceGaps.length}.\n` +
          `A new call site is reading config through a widened schema, so its\n` +
          `slot name is unchecked and a typo there fails silently at runtime.\n` +
          `Type the model's configSchema param to its concrete type, or — if it\n` +
          `is genuinely a mixin — run with --write and say why in the commit.`,
      )
      return 1
    }
    if (sourceGaps.length < prevCount) {
      console.log(
        `Improved (${prevCount} -> ${sourceGaps.length}); re-run with --write to lower the baseline.`,
      )
    }
    return 0
  }
}

process.exitCode = main()
