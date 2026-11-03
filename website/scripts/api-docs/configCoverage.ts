import { wrapAdapterExample } from './configExamples.ts'
import { configManifest } from './configManifest.ts'
import {
  collectBaseConfigs,
  configCategory,
  isContainerSlot,
  resolveBase,
} from './generateConfigDocs.ts'
import { slotMetaFor } from './slotSource.ts'

import type { ManifestSlot } from './configManifest.ts'
import type { ConfigIndex, ConfigWithHeader } from './configTypes.ts'

// One entry per config that declares a `baseConfiguration` we couldn't link to a
// documented #config. Driven off the full config set rather than per-render-pass
// base chains, so each unresolved derivation is listed exactly once and always
// attributed to the config that actually declares it (not a page that inherits
// it transitively).
export function unresolvedBases(
  configs: ConfigWithHeader[],
  index: ConfigIndex,
) {
  return configs
    .filter(config => config.derives && !resolveBase(config, index))
    .map(
      config =>
        `${config.header.name} (${config.derives!.code.replace(/\s+/g, ' ').trim()})`,
    )
}

// An adapter page wraps its #example in a full track config of its #trackType.
// Without the tag we fall back to FeatureTrack, which is wrong for e.g.
// alignments/variant/sequence adapters, so the page shows a config that would
// not work — list it so the author adds the tag.
export function adaptersMissingTrackType(configs: ConfigWithHeader[]) {
  return configs
    .filter(config => {
      const isAdapter =
        configCategory(config.header.name, config.header.category) === 'Adapter'
      // only when an example would actually be wrapped: an author who wrote the
      // full track config by hand hits wrapAdapterExample's `alreadyFull` guard
      // and keeps their own `type`, so no default was applied and there is
      // nothing to flag (MotifListAdapter was caught on exactly this)
      const wouldWrap = config.header.examples.some(
        ex => wrapAdapterExample(ex.content) !== ex.content,
      )
      return isAdapter && wouldWrap && !config.header.trackType
    })
    .map(config => config.header.name)
}

// A slot with neither a JSDoc comment nor an in-object `description` renders a
// blank Description cell — a name and a type with no explanation, which reads
// as "this setting does nothing" rather than as a missing sentence.
//
// Container sub-schemas are exempt because `slotsTable` already hides their
// rows (see isContainerSlot): they carry no type, default or prose of their
// own, their children are listed as `index.*` rows, and describing one only
// surfaces a row whose Type cell is a dumped `ConfigurationSchema(...)`. Asking
// for a description there sends the next author hunting for a sentence that
// makes the page worse.
export function slotsMissingDescription(configs: ConfigWithHeader[]) {
  return configs.flatMap(c =>
    c.slots
      .filter(s => {
        const { meta } = slotMetaFor(s)
        return (
          !(s.docs || meta.description) && !isContainerSlot(s, meta, c.slots)
        )
      })
      .map(s => ({ file: c.filename, name: `${c.header.name}.${s.name}` })),
  )
}

// Fatal, for the same reason an untagged `#slot` is (see assertNoUntaggedSlots).
// This spent a long time as a line in the committed coverage list, which cannot
// hold a count at zero: the command that reports a new gap is the same command
// that records it as accepted, so a slot only has to be committed undescribed
// once to stay that way. 99 of them accumulated that way across ~50 schemas
// before anyone counted, including both location slots of CramAdapter — the
// entire useful surface of that page. The count is zero now, and the fix is one
// sentence at a definition site the error names exactly, so it can be held
// there. Gaps with a real backlog (a missing #example) stay in the coverage
// list; this one graduates.
export function assertNoBlankSlotDescriptions(
  gaps: { file: string; name: string }[],
) {
  if (gaps.length) {
    const byFile = new Map<string, string[]>()
    for (const gap of gaps) {
      byFile.set(gap.file, [...(byFile.get(gap.file) ?? []), gap.name])
    }
    throw new Error(
      `${gaps.length} config slot(s) would render a blank Description cell. Write the prose as a JSDoc body under the slot's #slot tag — the generator prefers it over an in-object \`description\`, and unlike \`description\` a comment is not shipped in the plugin bundle (that field is the config editor's helper text, so use it only when someone editing the slot in the UI needs the hint):\n${[
        ...byFile,
      ]
        .map(([file, list]) => `  ${file}: ${list.join(', ')}`)
        .join('\n')}`,
    )
  }
}

// Every slot the live schema carries has to reach the type's page as a row.
//
// The repo enumerates config slots twice and nothing compared the two. This
// generator reads source ASTs and so can only see what a JSDoc tag points it
// at; `configManifest.generated.ts` instantiates the real ConfigurationSchema
// objects and reads their MST properties, which cannot miss a slot because the
// slot is on the object. Every gap between them is the docs' — and every one of
// them fails silently in the direction that reads as a fact: a page listing
// fewer settings than the type accepts looks like a type with fewer settings.
//
// A `baseConfiguration:` with no `#baseConfiguration` tag is the shape that
// motivated this. It drops the config's whole inherited chain, and the existing
// unresolved-base gap list cannot report it — that list holds bases that failed
// to RESOLVE, and an untagged one is never looked up at all.
//
// Three shapes are absent from a page by design, each exempt by a property of
// the manifest entry rather than by name:
//   - `type`, the discriminator. Not a setting anyone tunes, and `slotNesting`
//     plus every `#example` already show it in place.
//   - `identifier`-typed slots (trackId, displayId, connectionId), which
//     carry an `#identifier` tag rather than
//     `#slot` and render as the page's identity, not a row.
//   - a container sub-schema, whose own row `slotsTable` hides (isContainerSlot)
//     and whose children render as `index.*` rows.
export function assertManifestSlotsAreDocumented(
  configs: ConfigWithHeader[],
  index: ConfigIndex,
) {
  const pages = manifestPages(configManifest())
  const problems = configs.flatMap(cfg => {
    const page =
      pages.get(cfg.header.name) ??
      (cfg.header.schemaName ? pages.get(cfg.header.schemaName) : undefined)
    const rows = [cfg, ...collectBaseConfigs(cfg, index)].flatMap(c => c.slots)
    const documented = rowNamesUnder(
      rows.map(s => s.name),
      page?.keys,
    )
    const paged = rowNamesUnder(
      rows.filter(s => s.schemaPage ?? s.subSchema?.page).map(s => s.name),
      page?.keys,
    )
    const missing = (page?.slots ?? []).flatMap(slot =>
      missingSlotNames(slot, documented, paged),
    )
    return missing.length
      ? [
          `  ${cfg.filename}: ${cfg.header.name} renders no row for ${missing
            .map(name => `\`${name}\``)
            .join(', ')}`,
        ]
      : []
  })
  if (problems.length) {
    throw new Error(
      `${problems.length} config page(s) leave out a slot the live schema carries. The commonest cause is a \`baseConfiguration:\` with no \`#baseConfiguration\` JSDoc tag above it, which drops every inherited slot from the page at once; otherwise the slot needs a \`#slot\` tag of its own:\n${problems.join('\n')}`,
    )
  }
}

// The slots each page owes a row: a type's are its manifest entry's, and a
// sub-schema's, which no entry names, are what the manifest lists under that
// schema where a slot first nests it. `keys` are the slot names that nest it,
// since a sub-schema page may name its rows from there (`formatAbout.config`).
export function manifestPages(
  manifest: Record<string, { slots: ManifestSlot[] }>,
) {
  const pages = new Map<string, { slots: ManifestSlot[]; keys: Set<string> }>()
  const visit = (slots: ManifestSlot[]) => {
    for (const slot of slots) {
      if (slot.schema && slot.subSlots) {
        const page = pages.get(slot.schema)
        if (page) {
          page.keys.add(slot.name)
        } else {
          pages.set(slot.schema, {
            slots: slot.subSlots,
            keys: new Set([slot.name]),
          })
        }
      }
      visit(slot.subSlots ?? [])
    }
  }
  for (const [name, entry] of Object.entries(manifest)) {
    pages.set(name, { slots: entry.slots, keys: new Set() })
  }
  for (const entry of Object.values(manifest)) {
    visit(entry.slots)
  }
  return pages
}

// A page's row names, each also under the path from a slot nesting its schema
export function rowNamesUnder(names: string[], keys = new Set<string>()) {
  const prefixes = [...keys].map(key => `${key}.`)
  return new Set(
    names.flatMap(name => [
      name,
      ...prefixes
        .filter(prefix => name.startsWith(prefix))
        .map(prefix => name.slice(prefix.length)),
    ]),
  )
}

// Which of one manifest slot's names the page owes a row for. A container is
// covered by every child, or by its own row when that row links the page
// documenting its sub-schema (`formatDetails`). A container row linking
// nothing names the children it is missing: SyntenyColor's `scale` row once
// stood in for thirteen slots no page showed.
export function missingSlotNames(
  slot: ManifestSlot,
  documented: Set<string>,
  paged: Set<string>,
) {
  if (slot.name === 'type' || slot.type === 'identifier') {
    return []
  }
  if (slot.subSlots?.length) {
    const missing = slot.subSlots
      .map(child => `${slot.name}.${child.name}`)
      .filter(name => !documented.has(name))
    return paged.has(slot.name) ? [] : missing
  }
  return documented.has(slot.name) ? [] : [slot.name]
}
