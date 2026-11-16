import * as ts from 'typescript'

import { isSchemaCall, schemaCallName } from './astShapes.ts'
import { getOwnJSDocTagText, jsDocText, startsWithTag } from './jsDocTags.ts'
import { repoRelative } from './util.ts'

// A documented member whose only prose sits after a JSDoc `@tag`, where the
// generator cannot see it.
export interface DocsBehindTagGap {
  filename: string
  name: string
}

// Whether a docs-tagged block carries prose of its own: any line that is neither
// blank nor one of the `#tag` lines the generator reads as structure.
function hasOwnProse(comment: string) {
  return comment
    .split('\n')
    .some(line => line.trim() && !/^#\w+/.test(line.trim()))
}

export function collectDocsBehindATag(
  node: ts.Node,
  comment: string,
  name: string,
  gaps: DocsBehindTagGap[],
) {
  if (!hasOwnProse(comment) && getOwnJSDocTagText(node).trim()) {
    gaps.push({ filename: node.getSourceFile().fileName, name })
  }
}

// Fatal, on the argument assertNoBlankSlotDescriptions makes: the count is zero
// and the fix is moving one sentence within the docstring the error names.
//
// A member with no prose at all renders a blank cell too, and 2,887 of those
// exist — a backlog, not a bug. This one is narrower and worse: the author DID
// write the sentence, and the page shows nothing. Three members reached the site
// that way (both mixins' `addTrackConf` and `getTracksById`), each of them the
// row telling a plugin author that a deprecated name still resolves and what to
// call instead.
export function assertNoDocsBehindATag(gaps: DocsBehindTagGap[]) {
  if (gaps.length) {
    throw new Error(
      `${gaps.length} documented member(s) put every word of their prose after a JSDoc @tag, so TypeScript files it under \`tags\` and the generator publishes a blank Description cell. Lead with the prose and leave the bare tag under it (\`@deprecated\` on its own line):\n${gaps
        .map(g => `  ${repoRelative(g.filename)} ${g.name}`)
        .join('\n')}`,
    )
  }
}

// A config slot that a #config schema declares but never tags with #slot, so it
// is silently absent from the generated docs (the failure mode that hid
// configuration.shareURL when its comment used /* instead of /**).
export interface ConfigSlotGap {
  filename: string
  schema: string
  slot: string
}

// Audit one `ConfigurationSchema('Name', { ...slots })` call: every own property
// of the slots object should carry a #slot tag. A property whose value is itself
// an inline `ConfigurationSchema(...)` is a grouping sub-schema (its children are
// the slots, e.g. hierarchical.sort), so it is skipped; spreads (plugin/extra
// slot injection) are skipped too.
export function collectUntaggedSlots(node: ts.Node, gaps: ConfigSlotGap[]) {
  if (isSchemaCall(node)) {
    const schema = schemaCallName(node) ?? '(anonymous)'
    const slots = node.arguments[1]
    if (slots && ts.isObjectLiteralExpression(slots)) {
      for (const prop of slots.properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          ts.isIdentifier(prop.name) &&
          !isSchemaCall(prop.initializer) &&
          !startsWithTag(jsDocText(prop), 'slot')
        ) {
          gaps.push({
            filename: prop.getSourceFile().fileName,
            schema,
            slot: prop.name.text,
          })
        }
      }
    }
  }
}

// Fatal, not a warning. A slot a `#config` schema declares but never tags is
// absent from the generated page entirely — the failure mode that hid
// `configuration.shareURL` when its comment used `/*` instead of `/**`. The
// count is zero, and the fix is unambiguous and local, so the only way it stays
// zero is if adding one stops the build rather than printing a line nobody
// reads. Everything with a real backlog goes in the committed coverage list
// instead; this is the one that can be held at zero.
export function assertNoUntaggedSlots(gaps: ConfigSlotGap[]) {
  if (gaps.length) {
    const byFile = new Map<string, ConfigSlotGap[]>()
    for (const gap of gaps) {
      const file = repoRelative(gap.filename)
      byFile.set(file, [...(byFile.get(file) ?? []), gap])
    }
    throw new Error(
      `${gaps.length} config slot(s) in a #config schema have no #slot tag, so they are silently missing from the generated docs. Add a /** #slot */ comment (a single-star /* comment is ignored):\n${[
        ...byFile,
      ]
        .map(
          ([file, list]) =>
            `  ${file}: ${list.map(g => `${g.schema}.${g.slot}`).join(', ')}`,
        )
        .join('\n')}`,
    )
  }
}

/**
 * Every registered display type must have a `#config` block of its own name.
 *
 * Fatal, like `assertNoUntaggedSlots` above and for the same reason: the count
 * is zero, and the fix is local and unambiguous. What it prevents is entirely
 * silent — a display whose schema is built by a `makeConfigSchema(typeName)`
 * helper has no `#config` block anywhere, because the generator keys a block to
 * its FILE and cannot see a name that only exists as a parameter at runtime. So
 * the display gets no config page, renders as bare unlinked text in the
 * track-type table, and — worst — the shared base it derives from is left as
 * the only documented name, so ITS slot table tells readers to write
 * `type: '<Base>Display'`, which nothing accepts.
 *
 * That has happened twice: the two GC-content displays, then the two LD ones.
 * Both times it was found by a person reading a docs page, not by a check. The
 * fix both times was one annotated file per registered type.
 *
 * `sources` excludes test files (see `corpusFiles`), so the fixtures that
 * hand-build a `new DisplayType(...)` never reach `displayToTrackType` and this
 * needs no exclusion list of its own.
 */
export function assertEveryDisplayTypeIsDocumented(
  displayToTrackType: Map<string, string>,
  configNames: Set<string>,
) {
  const missing = [...displayToTrackType.keys()]
    .filter(name => !configNames.has(name))
    .sort((a, b) => a.localeCompare(b, 'en'))
  if (missing.length) {
    throw new Error(
      `${missing.length} registered display type(s) have no #config block of their own name, so they get no config page and drop out of every generated table. Give each one an annotated schema file — a schema built from a \`makeConfigSchema(typeName)\` helper cannot be seen, since a #config block is keyed to its file:\n${missing
        .map(name => `  ${name}`)
        .join('\n')}`,
    )
  }
}
