/// <reference types="jest" />

/**
 * The size a `<Video>` embed reserves has to be the size of the clip the store
 * serves, and the two are derived from different things: the embed's comes from
 * the spec's capture viewport through `gen-live-links`, the clip's from whatever
 * ffmpeg wrote. A spec re-framed without `pnpm autogen` leaves the page holding
 * a box the wrong shape, and the browser letterboxes the clip inside it —
 * nothing throws, and no figure check looks at a video's dimensions.
 *
 * This reads the committed manifest rather than the disk, for the reason
 * check-figure-refs gives: media bytes are gitignored, so a checkout that has
 * not pulled would answer "nothing is here" to every question.
 *
 * It reads the GENERATED file rather than the spec list because jest cannot
 * transform the puppeteer ESM that scripts/video-specs.ts pulls in — and that
 * is the half worth checking anyway, since the generated file is what the site
 * reads.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { videoFrames } from '../src/lib/liveLinks.generated.ts'

const manifest = readFileSync(
  join(__dirname, '..', 'media.lock'),
  'utf8',
).split('\n')

const posterSizes = new Map(
  manifest.flatMap(line => {
    const match =
      /^website\/static\/media\/(.+)\.jpe?g (\d+)x(\d+) \d+ [0-9a-f]+$/.exec(
        line,
      )
    return match
      ? [[match[1]!, { width: Number(match[2]), height: Number(match[3]) }]]
      : []
  }),
)

test.each(Object.entries(videoFrames))(
  '%s reserves the frame the store serves',
  (name, frame) => {
    const poster = posterSizes.get(name)
    expect(poster).toBeDefined()
    expect(poster).toEqual(frame)
  },
)

test('the manifest names no clip the site cannot size', () => {
  expect(
    [...posterSizes.keys()].filter(name => !(name in videoFrames)),
  ).toEqual([])
})
