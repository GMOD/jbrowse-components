import { CODE_BASE, retargetCodeBase } from './code-base.ts'

import type { Code } from 'mdast'

// The `?config=…&session=spec-…` link a ```json live fence opens, built from
// the fence's own JSON and its `config=` / `base=` meta, as
// remark-spec-example.ts builds it.

function parseMeta(meta: string | null | undefined) {
  const out: Record<string, string> = {}
  for (const m of (meta ?? '').matchAll(
    /(\w+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g,
  )) {
    out[m[1]!] = m[2] ?? m[3] ?? m[4] ?? ''
  }
  return out
}

export function isLive(node: Code) {
  return node.lang === 'json' && 'live' in parseMeta(node.meta)
}

export function deriveSpecUrl(spec: unknown, meta: string | null | undefined) {
  const { base, config } = parseMeta(meta)
  const params = [
    config ? `config=${encodeURIComponent(config)}` : '',
    `session=spec-${encodeURIComponent(JSON.stringify(spec))}`,
  ].filter(Boolean)
  return `${base ? retargetCodeBase(base) : CODE_BASE}?${params.join('&')}`
}
