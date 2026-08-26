import { hosted, rExportCliArgs } from './rexportCliArgs.ts'
import { specs } from './screenshot-specs.ts'

import type { SourceView } from './rexportCliArgs.ts'
import type { RExportSpec } from './screenshot-spec-types.ts'

// The one place that turns an rexport spec into the jb2export invocation that
// makes its figure. Two callers, and they must not drift: the sweep
// (generate-screenshots) RUNS it, and the gallery page PUBLISHES it as the
// command a reader can paste. A published command that isn't the one that made
// the picture is worse than no command at all, so neither side derives it
// itself — both take this argv verbatim and append only `--out`.
//
// Two forms come out of here. A spec with a `cli` block gets the ordinary
// file-flag command (`--fasta … --bam …`), which is what a reader typing
// jb2export writes and what names the data outright; everything else keeps
// `--config … --spec …`. Either way the loc, the panel order and every display
// setting are read out of the source figure's session spec, so `cli` cannot
// drift onto a different view — see rexportCliArgs.ts, which is where that
// derivation lives and is tested.

function sourceSession(spec: RExportSpec) {
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
  const sessionSpec = JSON.parse(
    decodeURIComponent(session.slice('spec-'.length)),
  ) as { views: SourceView[] }
  return { configUrl: hosted(config), sessionSpec, view: sessionSpec.views[0]! }
}

/**
The jb2export argv that draws one gallery figure, everything but `--out`.
*/
export function rExportInvocation(spec: RExportSpec): string[] {
  const { configUrl, sessionSpec, view } = sourceSession(spec)
  if (spec.cli) {
    if (spec.extraArgs) {
      throw new Error(
        `${spec.name}: extraArgs addresses a config trackId, which a cli command has no config for — put the setting in that track's opts instead`,
      )
    }
    return rExportCliArgs(spec.name, spec.cli, view)
  }
  // --spec, not --session: the url carries a session *spec* (the declarative
  // `{views:[{type,assembly,loc,tracks}]}` the web resolves on attach), where
  // --session wants a saved session snapshot. jb2export takes that spec shape
  // verbatim for an LGV, so the two figures are built from one description. It
  // goes inline rather than as a path — that is what makes the published line
  // pasteable, and it means the sweep runs the very argv that is published.
  return [
    '--config',
    configUrl,
    '--spec',
    JSON.stringify(sessionSpec),
    ...(spec.extraArgs ?? []),
  ]
}
