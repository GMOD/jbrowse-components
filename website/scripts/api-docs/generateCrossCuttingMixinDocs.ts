import fs from 'fs'

import {
  composeCalls,
  listSources,
  markdownTable,
  rewriteMarkerBlock,
  runMarkerScript,
} from './util.ts'

// Render the cross-cutting-mixin table in the architecture spec from the source,
// the way `generateDisplayFoundationDocs` already does for the foundations.
//
// The two tables answer different questions and fail differently, which is the
// whole reason this one exists. A foundation is the display's spine: get it
// wrong and nothing works, so the table drifting is a doc bug. A cross-cutting
// mixin is opt-in — composing it *is* the opt-in — so a display that should
// have one and doesn't just quietly does less. The spec's version of this table
// was hand-written and had no users column at all, so there was nowhere for an
// adoption gap to show up. Sorting most-composed-first puts the outliers at the
// bottom, which is the row worth asking about.
//
// One block, rendered into **both** `agent-docs/ARCHITECTURE.md` and the public
// `creating_display.md` — not two variants the way the foundations pair is.
// They differ there because the guide wants prose about what a foundation
// brings while the spec wants the mixin list; here the useful content is the
// same question from both sides ("which mixins exist, and what already composes
// them"), and rendering it twice is what keeps this tag from being tooling that
// only an internal doc reads.
//
// One tag, on the JSDoc block that already carries the mixin's `#stateModel`:
//
//   /** #stateModel HeightModeMixin
//       #crossCuttingMixin Track-height strategy. The display supplies ... */
//
// Nothing is tagged on the consumer side, unlike `#displayFoundation`. A
// composer is read straight off `types.compose('<Name>', ..., TheMixin(), ...)`,
// so a display joins a row by composing the mixin and cannot join it any other
// way — which is exactly the property the column is being read for. The
// foundations table needs its tag because a display can also *inherit* a
// foundation by extending another display's whole model, and no compose call
// records that.
const SOURCE_DIRS = ['packages', 'plugins']

// `#stateModel <Name>` followed, within the same JSDoc, by the tag. Same
// comment-body walk as the foundations scan, so a tag can't be picked up from
// the next JSDoc down the file.
//
// The value runs to end of line, `*` included, and a same-line `*/` is trimmed
// off after. `#displayFoundationDef`'s scan excludes `*` from the value
// instead, which also excludes it from the *prose* — so a tag saying
// "`minScore` / `maxScore` / `*Bound`" or "compose **after**" is truncated at
// the first star, generating a cell that ends mid-sentence and says so
// nowhere. Both of this table's first tags hit it.
const DEF =
  /#stateModel\s+(\w+)[^*]*(?:\*(?!\/)[^*]*)*?#crossCuttingMixin\s+([^\n]+)/g

// Trailing `*/` where the tag is the last line of its JSDoc, plus the padding
// before it.
const TRAILING_COMMENT_END = /\s*\*\/\s*$/

// Every `#stateModel <Name>` with its offset, so a compose call can be
// attributed to the model whose JSDoc precedes it.
const MODEL = /#stateModel\s+(\w+)/g

interface CrossCuttingMixin {
  name: string
  supplies: string
  composedBy: string[]
}

// The name to print for a `types.compose(...)` call site: the nearest
// `#stateModel` tag above it, falling back to the compose call's own string
// literal.
//
// Not just the literal, because one model deliberately composes under a
// borrowed name — `MultiSampleVariantBaseModel` passes
// `'LinearMultiSampleVariantMatrixDisplay'` for snapshot-compatibility reasons
// its own comment explains. Taking the literal would file the shared base under
// one of its two subclasses and silently drop the other, which is the same
// under-reporting this table exists to prevent.
function modelNameAt(models: { name: string; pos: number }[], pos: number) {
  let best: string | undefined
  for (const model of models) {
    if (model.pos < pos) {
      best = model.name
    }
  }
  return best
}

// Walk one file's compose calls, recording which models compose which mixins.
function collectComposes(file: string, src: string) {
  const models = [...src.matchAll(MODEL)].map(m => ({
    name: m[1]!,
    pos: m.index,
  }))
  return composeCalls(file, src).flatMap(call => {
    const composer = modelNameAt(models, call.pos) ?? call.name
    return call.mixins.map(mixin => ({ mixin, composer }))
  })
}

export function collectCrossCuttingMixins() {
  const defs = new Map<string, string>()
  const composedBy = new Map<string, Set<string>>()
  for (const dir of SOURCE_DIRS) {
    for (const file of listSources(dir)) {
      const src = fs.readFileSync(file, 'utf8')
      for (const [, name, supplies] of src.matchAll(DEF)) {
        // A `|` would silently split the markdown cell it lands in and shift
        // every column after it, so reject it where it is written rather than
        // rendering a broken table.
        if (supplies!.includes('|')) {
          throw new Error(
            `#crossCuttingMixin ${name} contains a "|", which breaks the markdown table cell`,
          )
        }
        // The rendered cell has to read as a sentence to someone with
        // ARCHITECTURE.md open and nothing else — that doc is handed to agents
        // directly, so a reference in it has to resolve from inside it. A
        // positional one ("see below the table") resolves only until the table
        // moves, and reads as nonsense in the source file the tag lives in.
        // Name the thing instead.
        if (/\b(above|below|earlier|later) the table\b/.test(supplies!)) {
          throw new Error(
            `#crossCuttingMixin ${name} points at where something sits in the rendered table. Name what it refers to instead — the tag is also read in ${file}, where the table does not exist.`,
          )
        }
        defs.set(name!, supplies!.replace(TRAILING_COMMENT_END, '').trim())
      }
      if (!src.includes('.compose(')) {
        continue
      }
      for (const { mixin, composer } of collectComposes(file, src)) {
        composedBy.set(
          mixin,
          (composedBy.get(mixin) ?? new Set()).add(composer),
        )
      }
    }
  }
  return [...defs]
    .map(([name, supplies]) => {
      const composers = composedBy.get(name)
      if (!composers?.size) {
        // A tagged mixin nothing composes is either dead or renamed. Either way
        // the row would render empty, which reads as "nobody has adopted this
        // yet" rather than as a broken scan.
        throw new Error(
          `#crossCuttingMixin ${name} is composed by nothing — is the tag on a mixin that was renamed or deleted?`,
        )
      }
      return {
        name,
        supplies,
        composedBy: [...composers].sort((a, b) => a.localeCompare(b)),
      } satisfies CrossCuttingMixin
    })
    .sort(
      (a, b) =>
        b.composedBy.length - a.composedBy.length ||
        a.name.localeCompare(b.name),
    )
}

const code = (names: string[]) => names.map(n => `\`${n}\``).join(', ')

function renderTable(mixins: CrossCuttingMixin[]) {
  return markdownTable(
    ['Mixin', 'The display supplies', 'Composed by'],
    mixins.map(
      m => `| \`${m.name}()\` | ${m.supplies} | ${code(m.composedBy)} |`,
    ),
  )
}

export function writeCrossCuttingMixinDocs({ check = false } = {}) {
  return rewriteMarkerBlock(
    'CROSS_CUTTING_MIXINS',
    renderTable(collectCrossCuttingMixins()),
    { check },
  )
}

if (process.argv[1]?.endsWith('generateCrossCuttingMixinDocs.ts')) {
  runMarkerScript('Cross-cutting mixins table', writeCrossCuttingMixinDocs)
}
