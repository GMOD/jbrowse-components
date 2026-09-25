import { subcommandForViewType } from '../../../../products/jbrowse-img/src/modes.ts'
import { specTrackId, specTrackSettings, specTracks } from './decode.ts'

import type { SessionSpec, SpecTrackEntry, SpecView } from './decode.ts'

export interface ImgRecipe {
  command: string
  // view settings the command has no flag for, so its picture can differ
  dropped: string[]
}

const LINEAR_FLAGS = new Set(['trackLabels', 'showGridlines'])
const LINEAR_CARRIED = new Set(['type', 'assembly', 'loc', 'tracks'])

function quote(arg: string) {
  return /^[\w.,:/@%+=-]+$/.test(arg) ? arg : `'${arg.replaceAll("'", `'\\''`)}'`
}

function heredoc(file: string, value: unknown) {
  return [`cat > ${file} <<'JSON'`, JSON.stringify(value, null, 2), 'JSON', '']
}

// A spec entry's display as `display:<type>`, and its other settings as one
// JSON argument, which keeps each value's type: a `key=value` modifier reads
// its value back from text and loses that.
function trackArgs(entry: SpecTrackEntry) {
  const { type, ...settings } = Object.fromEntries(specTrackSettings(entry))
  return [
    '--track',
    specTrackId(entry),
    ...(typeof type === 'string' ? [`display:${type}`] : []),
    ...(Object.keys(settings).length ? [JSON.stringify(settings)] : []),
  ].map(quote)
}

function linearArgs(view: SpecView) {
  return [
    ['--assembly', view.assembly, '--loc', view.loc].map(a => quote(a!)),
    ...(view.trackLabels ? [['--trackLabels', String(view.trackLabels)]] : []),
    ...(view.showGridlines ? [['--showGridlines']] : []),
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
    dropped: linear
      ? Object.keys(view).filter(
          field => !LINEAR_CARRIED.has(field) && !LINEAR_FLAGS.has(field),
        )
      : [],
  }
}
