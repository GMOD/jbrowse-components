import fs from 'fs'
import path from 'path'

import { markdownTable, rewriteMarkerBlock } from './util.ts'

// The adapter base classes a plugin extends, and what each obliges it to
// implement, rendered into the custom-adapter guide from the declarations.
//
// The guide listed five kinds in prose and the directory has six — `CytobandAdapter`
// was missing — and it named none of the required methods except the feature
// adapter's two, which is the part a reader is actually looking for.
//
// The required members come off the declaration (`abstract m(...)` on a class,
// every member of an `interface X extends BaseAdapter`), so they cannot drift.
// Only the one-line description comes from a tag:
//
//   /** #adapterBase BaseFeatureDataAdapter | features overlapping a region */
//
// A file in the directory declaring a base with no tag is fatal.
const DIR = 'packages/core/src/data_adapters/BaseAdapter'

// Files that are not themselves an adapter base: the shared root, the options
// bag, helpers, tests, and the barrel.
const NOT_A_BASE = new Set([
  'BaseAdapter.ts',
  'cachedSetup.ts',
  'featureDensity.ts',
  'getAdapterId.ts',
  'index.ts',
  'stats.ts',
  'types.ts',
  'util.ts',
])

interface AdapterBase {
  name: string
  description: string
  members: string[]
  /**
   * Every name this file says it `extends`. Resolved against the tagged bases
   * rather than parsed positionally: the class header's generic list opens with
   * `CONF extends AnyConfigurationModel`, so the first `extends` in the file is
   * a constraint, not the superclass.
   */
  extendsNames: string[]
}

/**
 * Members a subclass must supply: `abstract foo(` on a class, and every method
 * signature in the body of an `interface X extends BaseAdapter`. Both forms are
 * one-per-line here and neither nests, so a line scan is enough.
 */
function requiredMembers(text: string, name: string) {
  const iface = new RegExp(
    `interface ${name} extends BaseAdapter \\{([\\s\\S]*?)\\n\\}`,
  ).exec(text)
  if (iface) {
    return [...iface[1]!.matchAll(/^\s*(\w+)\(/gm)].map(m => m[1]!)
  }
  return [...text.matchAll(/^\s*(?:public )?abstract (\w+)\(/gm)].map(
    m => m[1]!,
  )
}

export function collectAdapterBases(): AdapterBase[] {
  const bases: AdapterBase[] = []
  const untagged: string[] = []
  for (const file of fs.readdirSync(DIR).sort()) {
    if (
      !file.endsWith('.ts') ||
      file.endsWith('.test.ts') ||
      NOT_A_BASE.has(file)
    ) {
      continue
    }
    const text = fs.readFileSync(path.join(DIR, file), 'utf8')
    const tag = /#adapterBase\s+(\w+)\s*\|\s*([^\n*]+?)\s*(?:\*\/|\n)/.exec(
      text,
    )
    if (tag) {
      bases.push({
        name: tag[1]!,
        description: tag[2]!.trim(),
        members: requiredMembers(text, tag[1]!),
        extendsNames: [...text.matchAll(/\bextends (\w+)/g)].map(m => m[1]!),
      })
    } else {
      untagged.push(file)
    }
  }
  if (untagged.length > 0) {
    throw new Error(
      `these ${DIR} files declare an adapter base with no \`#adapterBase <name> | <description>\` tag, so they would be missing from the custom-adapter guide: ${untagged.join(', ')}. Add the tag, or add the file to NOT_A_BASE if it is not a base.`,
    )
  }
  const empty = bases.filter(b => b.members.length === 0)
  if (empty.length > 0) {
    throw new Error(
      `no required members found for ${empty.map(b => b.name).join(', ')} — the declaration shape changed, so the guide's "You supply" column would render empty`,
    )
  }
  return bases
}

/**
 * A subclass owes its base's abstracts too, so `BaseSequenceAdapter` — which
 * declares only `getRegions` and extends `BaseFeatureDataAdapter` — obliges a
 * plugin to write three methods, not one. Listing the one it declares would be
 * the table's most misleading row, since it is the row a sequence-adapter author
 * reads.
 */
function inheritedMembers(base: AdapterBase, all: AdapterBase[]): string[] {
  const parent = all.find(
    b => b.name !== base.name && base.extendsNames.includes(b.name),
  )
  return parent
    ? [...new Set([...inheritedMembers(parent, all), ...base.members])]
    : base.members
}

export function writeAdapterBaseDocs({ check = false } = {}) {
  const bases = collectAdapterBases()
  return rewriteMarkerBlock(
    'ADAPTER_BASES',
    markdownTable(
      ['Extend', 'You supply', 'It returns'],
      bases.map(
        b =>
          `| \`${b.name}\` | ${inheritedMembers(b, bases)
            .map(m => `\`${m}()\``)
            .join(', ')} | ${b.description} |`,
      ),
    ),
    { check },
  )
}
