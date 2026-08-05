// Validates that every field a session-spec launcher accepts is named somewhere
// in the URL params guide, and that every launchable view type has a section
// there at all.
//
// The gap this closes: a `LaunchView-<type>` handler declares its accepted args
// as a TypeScript type, and `urlparams.md` restates them as prose. Nothing tied
// the two together, so the prose drifted into a subset — five of the seven
// sections listed fewer fields than their launcher takes, and the reader's only
// symptom is a setting that appears not to exist. The synteny launcher's own
// comment already names this failure ("a hand-copied subset only ever meant that
// a field the view already honored was rejected by the type while working
// perfectly at runtime"); this is the same thing one level out, in the docs.
//
// Resolution goes through the TypeScript *checker*, not a syntactic scan, which
// is what makes it trustworthy: the seven arg types are built out of `extends`,
// `Partial<>`, `Omit<>` and `SnapshotIn<>` over interfaces in four packages, and
// a hand-rolled resolver would quietly under-report exactly where the drift
// already was (`LaunchBreakpointSplitViewArgs` is the whole model snapshot minus
// three keys). The checker returns the same property set the compiler would.
//
// What this does NOT check, on purpose:
//   - that a field is described *correctly*, or in the section for its own view
//     type. Presence anywhere in the page is the bar; the prose is a human's.
//   - the reverse direction (documented but not accepted). Mapping prose back to
//     a view type is guesswork, and a retired field leaves a harmless paragraph
//     rather than a missing one.
//
// Run: `pnpm check-launch-fields`.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as ts from 'typescript'

import { reportProblems, walkFiles } from './check-utils.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DOC = 'website/docs/urlparams.md'

// One entry per registered `LaunchView-<type>`. The file is the launcher; the
// type is the name of its args type in that file. Kept explicit rather than
// discovered so that a new launchable view type fails the coverage check below
// with "not listed here", instead of silently adding itself and being checked
// against a page that never mentions it.
const LAUNCHERS = [
  {
    viewType: 'LinearGenomeView',
    file: 'plugins/linear-genome-view/src/LaunchLinearGenomeView/index.ts',
    argsType: 'LaunchLinearGenomeViewArgs',
  },
  {
    viewType: 'CircularView',
    file: 'plugins/circular-view/src/LaunchCircularView/index.ts',
    argsType: 'LaunchCircularViewArgs',
  },
  {
    viewType: 'DotplotView',
    file: 'plugins/dotplot-view/src/LaunchDotplotView.ts',
    argsType: 'LaunchDotplotViewArgs',
  },
  {
    viewType: 'LinearSyntenyView',
    file: 'plugins/linear-comparative-view/src/LaunchLinearSyntenyView.ts',
    argsType: 'LaunchLinearSyntenyViewArgs',
  },
  {
    viewType: 'BreakpointSplitView',
    file: 'plugins/breakpoint-split-view/src/LaunchBreakpointSplitView/index.ts',
    argsType: 'LaunchBreakpointSplitViewArgs',
  },
  {
    viewType: 'SpreadsheetView',
    file: 'plugins/spreadsheet-view/src/LaunchSpreadsheetView/index.ts',
    argsType: 'LaunchSpreadsheetViewArgs',
  },
  {
    viewType: 'SvInspectorView',
    file: 'plugins/sv-inspector/src/LaunchSvInspectorView/index.ts',
    argsType: 'LaunchSvInspectorViewArgs',
  },
]

// Fields that are real but deliberately not documented per view type. Each needs
// a reason, because an entry here is a hole in the check.
const EXEMPT = new Map([
  // the launcher's own plumbing: loadSessionSpec supplies it, a spec never does
  ['session', 'supplied by the spec loader, not by the author'],
  // documented once for every view type rather than repeated in seven sections
  ['id', 'documented once as a field that works on every view type'],
  ['displayName', 'documented once as a field that works on every view type'],
  // BreakpointSplitView's args are its model snapshot minus three keys, so the
  // base view model's own props come along. They are not launcher fields in any
  // meaningful sense, and documenting them under one view type would imply the
  // other six take them, which they do not — every other launcher warns about
  // an unknown key instead.
  [
    'minimized',
    'a base view-model prop, reachable only via a snapshot-shaped launcher',
  ],
  ['$__mstEmpty__', 'an MST internal, not a field'],
  // superseded by fadeThinAlignmentsMode, and marked deprecated at its
  // declaration; documenting it would advertise the form we want retired
  ['fadeThinAlignments', 'deprecated in favour of fadeThinAlignmentsMode'],
])

function buildProgram(files: string[]) {
  return ts.createProgram(files, {
    noEmit: true,
    skipLibCheck: true,
    strict: false,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true,
  })
}

// The property names of `argsType` as the compiler resolves them, following
// every `extends`/intersection/`Omit`/`SnapshotIn` on the way.
function resolveFields(
  program: ts.Program,
  checker: ts.TypeChecker,
  file: string,
  argsType: string,
) {
  const sf = program.getSourceFile(file)
  if (!sf) {
    return undefined
  }
  let names: string[] | undefined
  const visit = (node: ts.Node) => {
    if (
      (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) &&
      node.name.text === argsType
    ) {
      names = checker
        .getPropertiesOfType(checker.getTypeAtLocation(node.name))
        .map(p => p.name)
    }
    node.forEachChild(visit)
  }
  visit(sf)
  return names
}

// A field counts as documented when the page names it as code (`nav`) or as a
// JSON key ("nav":) — not as a bare word, which would let an unrelated sentence
// containing "height" vouch for the slot.
function documents(doc: string, field: string) {
  return (
    doc.includes(`\`${field}\``) ||
    doc.includes(`"${field}"`) ||
    doc.includes(`\`&${field}=\``)
  )
}

// Every `LaunchView-<type>` the source registers, so a new launchable view type
// cannot be added without an entry in LAUNCHERS above.
//
// This walks the source tree rather than the LAUNCHERS files, which is the whole
// point: scanning only the files already listed makes the check circular —
// deleting an entry also deletes the file that would have reported it missing,
// and the run goes green having quietly stopped checking a view type. That is
// what the first version of this function did.
function registeredViewTypes() {
  const out = new Set<string>()
  for (const dir of ['plugins', 'packages', 'products']) {
    for (const file of walkFiles(
      join(root, dir),
      n => /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n),
      new Set(['node_modules', 'dist', 'esm', 'cjs', 'build']),
    )) {
      for (const m of readFileSync(file, 'utf8').matchAll(
        /addToExtensionPoint\(\s*'LaunchView-(\w+)'/g,
      )) {
        out.add(m[1]!)
      }
    }
  }
  return out
}

const doc = readFileSync(join(root, DOC), 'utf8')
const files = LAUNCHERS.map(l => join(root, l.file))
const program = buildProgram(files)
const checker = program.getTypeChecker()

const problems: string[] = []
let checked = 0

for (const { viewType, file, argsType } of LAUNCHERS) {
  const fields = resolveFields(program, checker, join(root, file), argsType)
  if (!fields) {
    problems.push(`${file}: no type named ${argsType} — did it get renamed?`)
    continue
  }
  if (!doc.includes(`"${viewType}"`)) {
    problems.push(
      `${DOC}: no session-spec example uses "type": "${viewType}", but ${file} registers a launcher for it`,
    )
  }
  for (const field of fields) {
    if (EXEMPT.has(field)) {
      continue
    }
    checked++
    if (!documents(doc, field)) {
      problems.push(
        `${DOC}: ${viewType} accepts \`${field}\` (${argsType} in ${file}), but the page never names it`,
      )
    }
  }
}

// The list above is hand-maintained; this is what stops it going stale silently.
for (const viewType of registeredViewTypes()) {
  if (!LAUNCHERS.some(l => l.viewType === viewType)) {
    problems.push(
      `LaunchView-${viewType} is registered but not listed in check-launch-fields.ts, so its fields are unchecked`,
    )
  }
}

reportProblems(
  problems,
  `All ${checked} session-spec launcher field(s) across ${LAUNCHERS.length} view types are documented in ${DOC}.`,
)
