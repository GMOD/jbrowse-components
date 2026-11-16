import { rewriteMarkerBlock } from '../markerDocs.ts'
import { forEachJSDoc, tagName, tagValues } from './jsDocTags.ts'
import { markdownTable } from './markdown.ts'
import { composeCalls } from './util.ts'

import type { SourceCorpus } from './sourceCorpus.ts'

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
// One block, rendered into **both** `agent-docs/reference/DISPLAY_PIPELINE.md` and the public
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

interface CrossCuttingMixin {
  name: string
  supplies: string
  composedBy: string[]
}

// The name to print for a `types.compose(...)` call site: the nearest
// `#stateModel` tag above it, falling back to the compose call's own string
// literal.
//
// Not just the literal: a model may compose under a name other than its
// documented one, and taking the literal would file it under the wrong model,
// the under-reporting this table exists to prevent.
function modelNameAt(models: { name: string; pos: number }[], pos: number) {
  let best: string | undefined
  for (const model of models) {
    if (model.pos < pos) {
      best = model.name
    }
  }
  return best
}

// Every `#stateModel` JSDoc in one file, with where it starts.
function documentedModels(corpus: SourceCorpus, file: string) {
  const models: { name: string; pos: number }[] = []
  forEachJSDoc(corpus.parse(file), (comment, node) => {
    const name = tagName(comment, 'stateModel')
    if (name) {
      models.push({ name, pos: node.getFullStart() })
    }
  })
  return models
}

// Walk one file's compose calls, recording which models compose which mixins.
function collectComposes(corpus: SourceCorpus, file: string) {
  const models = documentedModels(corpus, file)
  return composeCalls(file, corpus.read(file)).flatMap(call => {
    const composer = modelNameAt(models, call.pos) ?? call.name
    return composer ? call.mixins.map(mixin => ({ mixin, composer })) : []
  })
}

function collectDefs(corpus: SourceCorpus, file: string) {
  const defs: { name: string; supplies: string }[] = []
  forEachJSDoc(corpus.parse(file), comment => {
    const name = tagName(comment, 'stateModel')
    const [supplies] = tagValues(comment, 'crossCuttingMixin')
    if (name && supplies) {
      defs.push({ name, supplies })
    }
  })
  return defs
}

function collectCrossCuttingMixins(corpus: SourceCorpus) {
  const defs = new Map<string, string>()
  const composedBy = new Map<string, Set<string>>()
  for (const file of corpus.files) {
    const src = corpus.read(file)
    const tagged = src.includes('#crossCuttingMixin')
      ? collectDefs(corpus, file)
      : []
    for (const { name, supplies } of tagged) {
      // A `|` would silently split the markdown cell it lands in and shift
      // every column after it, so reject it where it is written rather than
      // rendering a broken table.
      if (supplies.includes('|')) {
        throw new Error(
          `#crossCuttingMixin ${name} contains a "|", which breaks the markdown table cell`,
        )
      }
      // The rendered cell has to read as a sentence to someone with
      // DISPLAY_PIPELINE.md open and nothing else — that doc is handed to agents
      // directly, so a reference in it has to resolve from inside it. A
      // positional one ("see below the table") resolves only until the table
      // moves, and reads as nonsense in the source file the tag lives in.
      // Name the thing instead.
      if (/\b(above|below|earlier|later) the table\b/.test(supplies)) {
        throw new Error(
          `#crossCuttingMixin ${name} points at where something sits in the rendered table. Name what it refers to instead — the tag is also read in ${file}, where the table does not exist.`,
        )
      }
      defs.set(name, supplies)
    }
    const composes = src.includes('.compose(')
      ? collectComposes(corpus, file)
      : []
    for (const { mixin, composer } of composes) {
      composedBy.set(mixin, (composedBy.get(mixin) ?? new Set()).add(composer))
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
        composedBy: [...composers].sort((a, b) => a.localeCompare(b, 'en')),
      } satisfies CrossCuttingMixin
    })
    .sort(
      (a, b) =>
        b.composedBy.length - a.composedBy.length ||
        a.name.localeCompare(b.name, 'en'),
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

export function writeCrossCuttingMixinDocs(corpus: SourceCorpus) {
  return rewriteMarkerBlock(
    'CROSS_CUTTING_MIXINS',
    renderTable(collectCrossCuttingMixins(corpus)),
  )
}
