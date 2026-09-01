// Fails on a tour whose mistake would otherwise leave a plausible-looking clip
// rather than an error, and on the pairing between the spec list and the pages
// that embed it.
//
//   node website/scripts/check-video-specs.ts
//
// The screenshot half of this has had `check-specs.ts` since the specs existed;
// the tours had nothing, and they are the corpus where a mistake is least likely
// to be noticed. A film is watched once and re-read never, the bytes live in a
// store rather than in git, and a spec is only read again by whoever re-films
// it — so a duplicate name, a dropped live link or a clip nothing embeds all
// survive a green build and a green deploy.
//
// The rules live in video-spec-rules.ts, where videoSpecRules.test.ts can reach
// them without the spec barrel's puppeteer. generate-video runs the same
// function before it films anything, since half of these cost an hour to
// discover at encode time.
import { readFileSync } from 'node:fs'

import { docFiles, reportProblems } from './check-utils.ts'
import { docRelative, docsDir } from './paths.ts'
import {
  validatePastePages,
  validateVideoEmbeds,
  validateVideoSpecs,
  videoEmbedsIn,
} from './video-spec-rules.ts'
import { externalClips, pastedTrackConfigs, videoSpecs } from './video-specs.ts'

const embeds = docFiles(docsDir).flatMap(file =>
  videoEmbedsIn(readFileSync(file, 'utf8'), docRelative(file)),
)

const problems = [
  ...validateVideoSpecs(
    videoSpecs,
    pastedTrackConfigs.map(pair => pair.video),
  ),
  // Externally filmed clips join the name check in both directions: an embed
  // may name one, and one nothing embeds is a clip published with nothing
  // playing it, exactly as for a tour.
  ...validateVideoEmbeds(embeds, [
    ...videoSpecs.map(spec => spec.name),
    ...externalClips.map(clip => clip.name),
  ]),
  ...validatePastePages(embeds, pastedTrackConfigs),
]

reportProblems(
  problems.map(problem => `  ${problem}`),
  `${videoSpecs.length} video spec(s), ${externalClips.length} external clip(s) and ${embeds.length} doc embed(s) pair up`,
)
