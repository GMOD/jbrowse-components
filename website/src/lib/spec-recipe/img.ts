import { subcommandForViewType } from '../../../../products/jbrowse-img/src/modes.ts'
import {
  nestedSettings,
  specTrackId,
  specTrackSettings,
  specTracks,
} from './decode.ts'

import type { SessionSpec, SpecTrackEntry, SpecView } from './decode.ts'

export interface ImgRecipe {
  command: string
}

export function quote(arg: string) {
  return /^[\w.,:/@%+=-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", `'\\''`)}'`
}

export function heredoc(file: string, value: unknown) {
  return [`cat > ${file} <<'JSON'`, JSON.stringify(value, null, 2), 'JSON', '']
}

// A spec entry's display as `display:<type>`, and its other settings as one
// JSON argument, which keeps each value's type: a `key=value` modifier reads
// its value back from text and loses that. The JSON nests a band's members
// again, since jbrowse-img reads no dotted key in it.
function trackArgs(entry: SpecTrackEntry) {
  const { type, ...settings } = nestedSettings(
    Object.fromEntries(specTrackSettings(entry)),
  )
  return [
    '--track',
    specTrackId(entry),
    ...(typeof type === 'string' ? [`display:${type}`] : []),
    ...(Object.keys(settings).length ? [JSON.stringify(settings)] : []),
  ].map(quote)
}

// The view's own settings go on `--view` as one JSON argument; `trackLabels`
// and `axis.grid` also set the export's options of those names, since the
// export draws labels and gridlines by its own options, not the view's.
function linearArgs(view: SpecView) {
  const { type, assembly, loc, tracks, ...settings } = view
  return [
    ['--assembly', assembly, '--loc', loc].map(a => quote(a!)),
    ...(Object.keys(settings).length
      ? [['--view', quote(JSON.stringify(settings))]]
      : []),
    ...(view.trackLabels ? [['--trackLabels', String(view.trackLabels)]] : []),
    ...((view.axis as { grid?: boolean } | undefined)?.grid
      ? [['--showGridlines']]
      : []),
    ...specTracks(view).map(trackArgs),
  ]
}

// The jbrowse-img command that draws a one-view figure without a browser: flags
// for a linear view, the spec itself for the views `--spec` renders.
export function imgRecipe(
  spec: SessionSpec,
  configUrl: string,
  width: number | undefined,
): ImgRecipe | undefined {
  const [view, ...rest] = spec.views ?? []
  const subcommand = view?.type ? subcommandForViewType(view.type) : undefined
  if (!view || rest.length || !subcommand) {
    return undefined
  }
  const linear = subcommand === 'lgv'
  if (linear && (!view.assembly || !view.loc)) {
    return undefined
  }
  const tracks = spec.sessionTracks?.length ? spec.sessionTracks : undefined
  const lines = [
    [`npx @jbrowse/img ${linear ? '' : `${subcommand} `}--config ${quote(configUrl)}`],
    ...(tracks ? [['--tracks tracks.json']] : []),
    ...(linear ? linearArgs(view) : [['--spec session.json']]),
    [...(width ? [`--width ${width}`] : []), '--out figure.svg'],
  ].map(args => args.join(' '))
  return {
    command: [
      ...(tracks ? heredoc('tracks.json', tracks) : []),
      ...(linear ? [] : heredoc('session.json', { views: [view] })),
      lines.join(' \\\n  '),
    ].join('\n'),
  }
}
