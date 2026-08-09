#!/usr/bin/env node
// Print a release's notes for the GitHub release body: summary + changelog,
// minus the frontmatter and Downloads block. Defaults to the newest post;
// `--tag v4.3.1` selects one. release.yml pipes this into `--notes-file`.
import { absolutizeImages, splitReleaseBody } from './releaseBlog.ts'
import { loadReleasePost } from './releaseCli.ts'

const { body } = loadReleasePost(process.argv.slice(2))
const { notes, changelog } = splitReleaseBody(body)

process.stdout.write(
  `${[absolutizeImages(notes), changelog].filter(Boolean).join('\n\n')}\n`,
)
