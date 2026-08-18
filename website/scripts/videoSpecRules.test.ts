/// <reference types="jest" />

/**
 * The tour rules, for the reason screenshotSpecs.test.ts gives about its own: a
 * rule that silently matches nothing is the failure mode it was written to
 * prevent, one level up. The committed corpus is clean and should stay that way,
 * so every case here is synthetic.
 *
 * The real list is checked by check-video-specs.ts in `pnpm check-docs`, and by
 * generate-video before it films.
 */
import {
  validateVideoEmbeds,
  validateVideoSpecs,
  videoEmbedsIn,
} from './video-spec-rules.ts'

import type { VideoSpec } from './video-spec-types.ts'

const spec = (over: Partial<VideoSpec> = {}): VideoSpec => ({
  name: 'topic/tour',
  url: '?config=x',
  description: 'A tour',
  steps: [],
  ...over,
})

const problems = (list: VideoSpec[], pasted: string[] = []) =>
  validateVideoSpecs(list, pasted).join('\n')

test('two specs sharing a name', () => {
  expect(problems([spec(), spec({ url: '?config=y' })])).toMatch(
    'two specs share this name',
  )
})

test('a name that is not a path under static/media', () => {
  expect(problems([spec({ name: 'Topic/Tour.mp4' })])).toMatch(
    'output path under static/media',
  )
})

test('a spec with no description', () => {
  expect(problems([spec({ description: '  ' })])).toMatch('no description')
})

test('an odd viewport side, which the encode rounds up', () => {
  expect(problems([spec({ viewportHeight: 1045 })])).toMatch(
    'viewportHeight 1045 is odd, and the encode rounds it up to 1046',
  )
  expect(problems([spec({ viewportWidth: 1281 })])).toMatch(
    'viewportWidth 1281 is odd',
  )
})

test('the default frame is even on both sides', () => {
  expect(problems([spec()])).toBe('')
})

test('a viewport past the delivery width', () => {
  expect(problems([spec({ viewportWidth: 1920 })])).toMatch(
    'past the 1600px delivery width',
  )
})

test('a spec that types a config nothing pairs to a page', () => {
  const pasting = [
    spec({
      steps: [
        { type: 'type', selector: '#box', value: '{\n  "trackId": "x"\n}' },
      ],
    }),
  ]
  expect(problems(pasting)).toMatch('not in pastedTrackConfigs')
  expect(problems(pasting, ['topic/tour'])).toBe('')
})

test('a locus typed into the search box is not a pasted config', () => {
  expect(
    problems([
      spec({
        steps: [{ type: 'type', selector: '#search', value: 'chr1:100-200' }],
      }),
    ]),
  ).toBe('')
})

// ── the doc side ───────────────────────────────────────────────────────────

const embedLine = '<Video src="/media/topic/tour.mp4" caption="A tour." />'

const embeds = (text: string) => videoEmbedsIn(text, 'tutorials/x.md')

test('a tag alone in its block', () => {
  const [embed] = embeds(`prose above\n\n${embedLine}\n\nprose below\n`)
  expect(embed).toMatchObject({
    line: 3,
    spec: 'topic/tour',
    caption: 'A tour.',
    alone: true,
  })
})

test('a tag whose block continues into prose, which the plugin drops', () => {
  expect(embeds(`${embedLine}\nprose directly under it\n`)[0]!.alone).toBe(
    false,
  )
})

test('two tags in one block, of which the plugin renders one', () => {
  const found = embeds(`${embedLine}\n${embedLine}\n\n`)
  expect(found).toHaveLength(2)
  expect(found.every(embed => embed.alone)).toBe(false)
})

test('a tag at the end of the file', () => {
  expect(embeds(`${embedLine}\n`)[0]!.alone).toBe(true)
})

const embedProblems = (text: string, specNames = ['topic/tour']) =>
  validateVideoEmbeds(embeds(text), specNames).join('\n')

test('a src naming no spec, which loses the live session link', () => {
  expect(
    embedProblems('<Video src="/media/topic/gone.mp4" caption="A tour." />\n'),
  ).toMatch('no video spec is named "topic/gone"')
})

test('a src that is not a media path', () => {
  expect(
    embedProblems('<Video src="/img/topic/tour.png" caption="A tour." />\n'),
  ).toMatch('is not `/media/<spec name>.mp4`')
})

test('an embed with no caption', () => {
  expect(embedProblems('<Video src="/media/topic/tour.mp4" />\n')).toMatch(
    'no caption',
  )
})

test('a spec no doc embeds', () => {
  expect(validateVideoEmbeds([], ['topic/tour']).join('\n')).toMatch(
    'no doc embeds this tour',
  )
})

test('a clean embed', () => {
  expect(embedProblems(`${embedLine}\n`)).toBe('')
})
