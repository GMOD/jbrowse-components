import { CODE_BASE } from '../src/lib/code-base.ts'
import { specs } from './screenshot-specs.ts'

import type { RExportSpec } from './screenshot-spec-types.ts'

// The one place that turns an rexport spec into the jb2export invocation that
// makes its figure. Two callers, and they must not drift: the sweep
// (generate-screenshots) RUNS it, and the gallery page PUBLISHES it as the
// command a reader can paste. A published command that isn't the one that made
// the picture is worse than no command at all, so neither side derives it
// itself.
export interface RExportInvocation {
  /** `--config`: absolute, since the emitted script's data uris are relative to it. */
  configUrl: string
  /** `--spec`: the session-spec JSON, decoded out of the source figure's url. */
  sessionSpec: string
  /** Extra `--track id '{...}'`-style arguments the rexport spec adds. */
  extraArgs: string[]
}

// A repo-relative config is rewritten onto CODE_BASE — the hosted mirror of
// test_data, which is also what the figure's "Open in JBrowse" link opens. A
// JBrowse config addresses its data RELATIVE TO ITSELF, so whatever base the
// config is fetched from is the base every track file inherits; and those uris
// are then read by rtracklayer / Rsamtools / samtools, which are built for
// remote genomics files over https and are markedly less happy range-reading a
// BigWig or CRAM off a local dev server.
export function rExportInvocation(spec: RExportSpec): RExportInvocation {
  const source = specs.find(s => s.name === spec.from)
  if (!source || source.mode !== 'url') {
    throw new Error(`from: "${spec.from}" is not a url spec`)
  }
  const query = new URLSearchParams(source.url.slice(1))
  const config = query.get('config')
  const session = query.get('session')
  if (!config || !session?.startsWith('spec-')) {
    throw new Error(`spec "${spec.from}" has no ?config=…&session=spec-… url`)
  }
  return {
    configUrl: /^https?:/.test(config) ? config : `${CODE_BASE}${config}`,
    sessionSpec: decodeURIComponent(session.slice('spec-'.length)),
    extraArgs: spec.extraArgs ?? [],
  }
}
