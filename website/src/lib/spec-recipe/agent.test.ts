import { captureFrame, compositeAgent } from './agent.ts'
import { decodeSpecUrl } from './decode.ts'
import { agentDialogHtml } from './html.ts'
import { figureCallouts, figureLiveRefs } from '../liveLinks.generated.ts'

jest.mock('../liveLinks.generated.ts', () => {
  const lgv = {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1-5000',
        tracks: ['volvox_cram'],
      },
    ],
  }
  const query = `?config=test_data/volvox/config.json&session=spec-${encodeURIComponent(JSON.stringify(lgv))}`
  const onData = {
    type: 'box',
    anchor: { track: 'volvox_cram', locus: 'ctgA:100-200' },
  }
  const onMenu = { type: 'box', anchor: { text: 'Sort by' } }
  const onAddedTrack = {
    type: 'box',
    anchor: { track: 'added_by_a_click', locus: 'ctgA:100' },
  }
  const atPixel = { type: 'text', text: 'here', x: 10, y: 20 }
  return {
    figureLiveRefs: { top: query, bottom: query },
    figureFrames: { plain: { width: 900, height: 500 } },
    videoFrames: {},
    figureCallouts: {
      plain: [onData, atPixel],
      menu: [onData, onMenu, onAddedTrack, atPixel],
      top: [onMenu],
      bottom: [onData],
    },
    figureClicks: { menu: { open: 'the track menu' }, top: {} },
    figureComposites: {
      pair: { parts: ['top', 'bottom'], horizontal: true, callouts: false },
      sheet: {
        parts: ['row', 'bottom'],
        horizontal: false,
        gutter: 40,
        callouts: true,
      },
      row: { parts: ['img/a', 'img/b'], horizontal: true, callouts: false },
    },
    figureImgArgs: {
      'img/a': ['breakpoint', '--loc', 'chr3:1-2', '--track', 'x', 'height:130'],
      'img/b': ['--loc', 'chr10:5-6'],
    },
  }
})

const decoded = decodeSpecUrl(
  `https://jbrowse.org/code/jb2/main/${figureLiveRefs.top}`,
)!
const [onData] = figureCallouts.bottom!

test('a figure without clicks hands every callout to --annotations', () => {
  const { command, notes } = captureFrame(decoded, 'plain')
  expect(command).toContain("cat > callouts.json <<'JSON'")
  expect(command).toContain('"x": 10')
  expect(command).toContain('--width 900 --height 500')
  expect(command).toContain(
    '--spec session.json --annotations callouts.json -o figure.png',
  )
  expect(notes).toEqual([])
})

// the command clicks nothing, so a callout on what the clicks opened would
// resolve to nothing and fail the run
test("a clicked figure keeps only the callouts on its session's own data", () => {
  const { command, notes } = captureFrame(decoded, 'menu')
  const callouts = JSON.parse(
    /callouts\.json <<'JSON'\n([\s\S]*?)\nJSON/.exec(command)![1]!,
  )
  expect(callouts).toEqual([onData])
  expect(notes).toEqual([
    "The figure's clicks open the track menu; this command draws the view under it.",
    'It leaves out 3 callouts anchored to what the clicks bring up.',
  ])
})

test('a figure with nothing else has no callout file', () => {
  const { command } = captureFrame(decoded, undefined)
  expect(command).not.toContain('callouts')
  expect(command).toContain('--spec session.json -o figure.png')
})

test('a composed figure is one command per frame, then the stacking', () => {
  const agent = compositeAgent('pair', new Map([['bottom', 'Result']]))!
  expect(agent.frames.map(f => f.label)).toEqual([
    'Frame 1',
    'Frame 2: Result',
  ])
  expect(agent.frames[0]!.command).toContain(
    '--spec session-1.json -o frame-1.png',
  )
  expect(agent.frames[0]!.notes).toEqual([
    'The figure was taken after clicks this command does not make, so its picture can differ.',
    'It leaves out the callout anchored to what the clicks bring up.',
  ])
  expect(agent.frames[1]!.command).toContain(
    '--spec session-2.json --annotations callouts-2.json -o frame-2.png',
  )
  expect(agent.stack).toBe(
    'magick frame-1.png frame-2.png -bordercolor white -border 12 +append figure.png',
  )
})

test('a composite of composites stacks its rows, and owns up to its own callouts', () => {
  const agent = compositeAgent('sheet')!
  expect(agent.frames.map(f => f.command)).toEqual([
    "npx @jbrowse/img breakpoint \\\n  --loc chr3:1-2 \\\n  --track x height:130 \\\n  --out frame-1.png",
    'npx @jbrowse/img --loc chr10:5-6 \\\n  --out frame-2.png',
    expect.stringContaining('-o frame-3.png'),
  ])
  expect(agent.stack).toBe(
    [
      'magick frame-1.png frame-2.png -bordercolor white -border 12 +append stack-1.png',
      'magick stack-1.png frame-3.png -background white -smush 40 figure.png',
    ].join('\n'),
  )
  expect(agent.notes).toHaveLength(1)
  expect(agentDialogHtml(agent, 'd')).toContain('The figure stacks 3 frames')
})

test('a figure that is not composed has no composite recipe', () => {
  expect(compositeAgent('plain')).toBeUndefined()
})
