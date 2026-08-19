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
  validatePastePages,
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
  expect(problems([spec({ viewportWidth: 2560 })])).toMatch(
    'past the 1920px delivery width',
  )
})

test('a drag that names only one of its two ends', () => {
  expect(
    problems([spec({ steps: [{ type: 'drag', from: { x: 1, y: 2 } }] })]),
  ).toMatch('name only one of their two ends')
  expect(
    problems([
      spec({ steps: [{ type: 'drag', toAnchor: { locus: 'ctgA:100' } }] }),
    ]),
  ).toMatch('name only one of their two ends')
})

test('a drag with an end of each kind', () => {
  expect(
    problems([
      spec({
        steps: [
          {
            type: 'drag',
            from: { x: 1, y: 2 },
            toAnchor: { locus: 'ctgA:100', band: '#ruler' },
          },
        ],
      }),
    ]),
  ).toBe('')
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

const embedProblems = (text: string, specNames = ['topic/tour']) =>
  validateVideoEmbeds(embeds(text), specNames).join('\n')

test('a tag alone in its block', () => {
  const [embed] = embeds(`prose above\n\n${embedLine}\n\nprose below\n`)
  expect(embed).toMatchObject({
    line: 3,
    spec: 'topic/tour',
    caption: 'A tour.',
    alone: true,
  })
})

test('a tag whose block continues into prose, which stays raw', () => {
  expect(embeds(`${embedLine}\nprose directly under it\n`)[0]!.alone).toBe(
    false,
  )
})

test('two tags in one block, which render as two adjacent figures', () => {
  const found = embeds(`${embedLine}\n${embedLine}\n\n`)
  expect(found).toHaveLength(2)
  expect(found.every(embed => embed.alone)).toBe(false)
})

test('a tag at the end of the file', () => {
  expect(embeds(`${embedLine}\n`)[0]!.alone).toBe(true)
})

// The scan spans lines because the plugin's does. Walking lines saw none of
// these, and the corpus was clean only because every tag in it happens to be one
// line with no angle bracket in its caption.

test('a tag split over two lines is still found', () => {
  const found = embeds(
    '<Video src="/media/topic/tour.mp4"\n  caption="A tour." />\n',
  )
  expect(found).toHaveLength(1)
  expect(found[0]).toMatchObject({
    line: 1,
    spec: 'topic/tour',
    caption: 'A tour.',
    closed: true,
    wrapped: true,
  })
})

test('a wrapped tag is a paragraph rather than an html block', () => {
  expect(
    embedProblems('<Video src="/media/topic/tour.mp4"\n  caption="A." />\n'),
  ).toMatch('put the whole tag on one line')
})

test('an angle bracket in a caption does not hide the tag', () => {
  const found = embeds(
    '<Video src="/media/topic/tour.mp4" caption="The <DEL> allele." />\n',
  )
  expect(found).toHaveLength(1)
  // `closed` is the assertion that bites. A `[^>]` scan stops at the caption's
  // own bracket and never reaches the `/>`, which leaves the tag looking like
  // one that never closed — found, named, and reported as the wrong fault.
  expect(found[0]).toMatchObject({
    spec: 'topic/tour',
    caption: 'The <DEL> allele.',
    closed: true,
  })
})

test('a tag that never closes, which the plugin does not match at all', () => {
  const found = embeds('<Video src="/media/topic/tour.mp4" caption="A.">\n')
  expect(found).toHaveLength(1)
  expect(found[0]!.closed).toBe(false)
})

test('an unclosed tag is reported once, not as every other fault too', () => {
  const reported = embedProblems(
    '<Video src="/media/topic/tour.mp4" caption="A.">\n',
  )
  expect(reported).toMatch('never closes')
  expect(reported.split('\n')).toHaveLength(1)
})

test('a poster the tag names', () => {
  expect(
    embeds(
      '<Video src="/media/topic/tour.mp4" poster="/media/topic/cover.jpg" caption="A." />\n',
    )[0]!.poster,
  ).toBe('/media/topic/cover.jpg')
})

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

// ── the paste pairing ──────────────────────────────────────────────────────

const pastePairs = (doc: string) =>
  validatePastePages(embeds(`${embedLine}\n`), [
    { video: 'topic/tour', doc },
  ]).join('\n')

test('a paste pair naming the page that embeds the tour', () => {
  expect(pastePairs('tutorials/x.md')).toBe('')
})

test('a paste pair left behind on a page the tour has moved off', () => {
  expect(pastePairs('tutorials/old.md')).toMatch(
    'checks its config against tutorials/old.md, which does not embed the tour',
  )
})
