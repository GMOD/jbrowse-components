export interface TypePage {
  category: string
  text: string
}

export interface TypePages {
  models: Record<string, TypePage>
  configs: Record<string, TypePage>
}

const KINDS = ['model', 'config'] as const
type Kind = (typeof KINDS)[number]

function pagesOf(pages: TypePages, kind: Kind) {
  return kind === 'model' ? pages.models : pages.configs
}

function findName(record: Record<string, TypePage>, name: string) {
  const wanted = name.toLowerCase()
  return Object.keys(record).find(k => k.toLowerCase() === wanted)
}

// One line per category, names only: an agent that has the name from
// jb.inspect or a config never needs this, and one that does not wants to scan
// 239 names in a screen, not page through them.
export function typeIndex(pages: TypePages) {
  const lines = KINDS.flatMap(kind => {
    const byCategory = new Map<string, string[]>()
    for (const [name, page] of Object.entries(pagesOf(pages, kind))) {
      const names = byCategory.get(page.category)
      if (names) {
        names.push(name)
      } else {
        byCategory.set(page.category, [name])
      }
    }
    return [...byCategory.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([category, names]) =>
          `${category} ${kind}s: ${names.sort((a, b) => a.localeCompare(b)).join(', ')}`,
      )
  })
  return `Read one with topic "model:<Name>" (runtime API: actions, getters, properties) or "config:<Name>" (config slots); a bare "<Name>" reads the model when one exists, else the config.\n\n${lines.join('\n')}\n`
}

// `model:X`, `config:X`, or bare `X` (model first — jb.inspect names model
// types, and the model page points at its config page). Case-insensitive; a
// miss names the near matches rather than the whole index.
export function lookupTypeDoc(
  pages: TypePages,
  topic: string,
): { text: string } | { error: string } | undefined {
  const prefixed = /^(model|config):(.+)$/.exec(topic)
  const kinds: Kind[] = prefixed ? [prefixed[1] as Kind] : ['model', 'config']
  const name = (prefixed ? prefixed[2]! : topic).trim()
  for (const kind of kinds) {
    const record = pagesOf(pages, kind)
    const hit = findName(record, name)
    if (hit) {
      return { text: record[hit]!.text }
    }
  }
  const needle = name.toLowerCase()
  const near = KINDS.flatMap(kind =>
    Object.keys(pagesOf(pages, kind))
      .filter(k => k.toLowerCase().includes(needle))
      .map(k => `${kind}:${k}`),
  )
  // The bundled pages cover in-tree types; a type a runtime plugin registers
  // (ProteinView, from jbrowse-plugin-protein3d) has no page, and the filmed
  // take that hit this read the plugin off the live tree only after trying
  // three other routes. Say so, and say how.
  return prefixed || near.length > 0
    ? {
        error: `No ${prefixed ? `${prefixed[1]} ` : ''}type "${name}".${near.length > 0 ? ` Near matches: ${near.slice(0, 12).join(', ')}.` : ''} Topic "types" lists every documented type. A type registered by a plugin has no page here: introspect it live instead — pluginManager.getViewType('${name}') says whether it exists, and jb.inspect on an instance (session.addView('${name}', {}) for a view) lists its getters and actions.`,
      }
    : undefined
}
