import fs from 'fs'

import { isKeyedWrites } from '../../../packages/add-track-core/src/keyedWrites.ts'

import type { KeyedWrites } from '../../../packages/add-track-core/src/keyedWrites.ts'
import type { FieldPresets } from '../../../packages/core/src/util/colorScale.ts'

// Which shorthand keys an adapter accepts in place of writing its location slot
// out, read from the manifest `jbrowse validate` checks against — the only place
// this is known, since a shorthand is whatever the adapter's snapshot normalizer
// chooses to rewrite and is found by probing it, not by reading a declaration.
// (`scripts/generateConfigManifest.ts`, which autogen runs before this.)
//
// Stated per adapter because the answer genuinely varies and the guides could
// only ever hedge at it: `uri` covers most adapters, 14 have no shorthand at
// all, and one page saying so beats a sentence in file_types.md that a reader
// has to take on faith.
const MANIFEST =
  'products/jbrowse-cli/src/commands/validate/configManifest.generated.ts'

// Read on first use rather than at module scope. Importing this module is how
// generate.ts reaches `accumulateConfig`, and an eager read made the import
// itself throw when the manifest was absent — a failure attributed to whatever
// happened to be running, rather than to the generator that needs the file.
export interface ManifestSlot {
  name: string
  // MST's name for the slot type. `identifier` marks the trackId/displayId
  // family, which no page carries a row for.
  type: string
  subSlots?: ManifestSlot[]
  schema?: string
  writes?: ManifestWrites
  liftsNumbers?: true
  fieldPresets?: FieldPresets<string>
}
interface ManifestEntry {
  slots: ManifestSlot[]
  shorthandKeys?: string[]
  displayTypes?: string[]
  // Displays only: the MST properties of the display's STATE model, which a
  // session snapshot sets and a track config cannot. Lets the example gate say
  // which wrong place a key is in rather than only that it is wrong.
  stateModelProps?: string[]
  legacyKeys?: string[]
  droppedKeys?: string[]
}
type ManifestCategories = Record<string, Record<string, ManifestEntry>>
export type TypedManifestEntry = ManifestEntry & { category: string }

let manifestTables: ManifestCategories | undefined
let manifestByType: Record<string, TypedManifestEntry> | undefined
let adapterShorthands: Record<string, ManifestEntry> | undefined

function readManifest() {
  if (!adapterShorthands) {
    const text = fs.readFileSync(MANIFEST, 'utf8')
    const json =
      /export const configManifest: ConfigManifest = (\{[\s\S]*\})\n/.exec(
        text,
      )?.[1]
    const parsed = json ? (JSON.parse(json) as ManifestCategories) : undefined
    if (!parsed?.adapters?.BamAdapter) {
      // A manifest this cannot read would silently mark every adapter as having
      // no shorthand, which reads as a fact rather than as a missing file.
      throw new Error(`could not read adapter shorthands from ${MANIFEST}`)
    }
    manifestTables = parsed
    adapterShorthands = parsed.adapters
    // Every type table, each entry tagged with the category it came from — the
    // two gates that read this want different subsets, and a gate that widened
    // the table would otherwise silently widen the other one too. The shape
    // guard drops what is not a type table: `views` (state-model props only)
    // and `migratedDisplayKeys`.
    manifestByType = Object.fromEntries(
      Object.entries(parsed)
        .flatMap(([category, table]) =>
          Object.entries(table).map(
            ([name, entry]) => [name, { ...entry, category }] as const,
          ),
        )
        .filter(([, entry]) => Array.isArray(entry.slots)),
    )
  }
  return {
    tables: manifestTables!,
    adapters: adapterShorthands,
    byType: manifestByType!,
  }
}

export function configManifestTables() {
  return readManifest().tables
}

export function shorthandKeysByAdapter() {
  return readManifest().adapters
}

export function configManifest() {
  return readManifest().byType
}

// Every sub-schema by name and how a settings bag writes it, off every slot the
// manifest lists at any depth.
type ManifestWrites = 'whole' | 'members' | KeyedWrites

let writesBySchema: Map<string, ManifestWrites> | undefined

function schemaWrites(name: string) {
  if (!writesBySchema) {
    const found = new Map<string, ManifestWrites>()
    const visit = (slots: ManifestSlot[] = []) => {
      for (const slot of slots) {
        if (slot.schema && slot.writes) {
          found.set(slot.schema, slot.writes)
        }
        visit(slot.subSlots)
      }
    }
    for (const entry of Object.values(configManifest())) {
      visit(entry.slots)
    }
    writesBySchema = found
  }
  return writesBySchema.get(name)
}

// A slot as the manifest declares it, by its config or sub-schema's name and
// its dotted path there (`aggregate.ops`).
let slotsBySchema: Map<string, ManifestSlot[]> | undefined

export function manifestSlot(schema: string, path: string) {
  if (!slotsBySchema) {
    const found = new Map<string, ManifestSlot[]>()
    const visit = (slots: ManifestSlot[] = []) => {
      for (const slot of slots) {
        if (slot.schema && slot.subSlots) {
          found.set(slot.schema, slot.subSlots)
        }
        visit(slot.subSlots)
      }
    }
    for (const [name, entry] of Object.entries(configManifest())) {
      found.set(name, entry.slots)
      visit(entry.slots)
    }
    slotsBySchema = found
  }
  let slots = slotsBySchema.get(schema)
  let slot: ManifestSlot | undefined
  for (const part of path.split('.')) {
    slot = slots?.find(s => s.name === part)
    slots = slot?.subSlots
  }
  return slot
}

// The string-list slots whose schema reads a number written in them as its
// string, by schema name: a ramp's `domain: [0, 100]` is legal JSON for a
// `stringArray`, which the bare type name would deny.
let numberSlotsBySchema: Map<string, Set<string>> | undefined

export function liftsNumbers(schema: string, slot: string) {
  if (!numberSlotsBySchema) {
    const found = new Map<string, Set<string>>()
    const visit = (name: string, slots: ManifestSlot[] = []) => {
      for (const s of slots) {
        if (s.liftsNumbers) {
          found.set(name, (found.get(name) ?? new Set()).add(s.name))
        }
        if (s.schema) {
          visit(s.schema, s.subSlots)
        }
      }
    }
    for (const [name, entry] of Object.entries(configManifest())) {
      visit(name, entry.slots)
    }
    numberSlotsBySchema = found
  }
  return numberSlotsBySchema.get(schema)?.has(slot) ?? false
}

// A write between a value and the one it refines clears nothing, in the
// user's words: a finer row answers to its coarser row's name
function refinesSentence(writes: KeyedWrites) {
  return Object.entries(writes.refines ?? {})
    .map(
      ([finer, coarser]) =>
        ` A write between \`${finer}\` and \`${coarser}\` clears nothing, since a \`${finer}\` row answers to its \`${coarser}\`'s name.`,
    )
    .join('')
}

// A setting's write mode, which a reader editing the JSON cannot see in it.
export function writesLine(name: string) {
  const writes = schemaWrites(name)
  return writes === 'whole'
    ? 'A setting written to it replaces it whole: a member left out returns to its default.'
    : writes === 'members'
      ? 'A setting written to it names members one by one: a member left out stays as it is, and `null` resets one.'
      : isKeyedWrites(writes)
        ? `A setting written to it names members one by one: a member left out stays as it is, and \`null\` resets one. One that changes \`${writes.keyedBy}\`${writes.emptyChanges ? ', emptying or filling it included,' : ''} first clears ${writes.keyed.map(m => `\`${m}\``).join(', ')}, which name the old values, except those it states.${refinesSentence(writes)}`
        : ''
}
