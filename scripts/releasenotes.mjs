#!/usr/bin/env node
// Print a release's notes for the GitHub release body: summary + changelog,
// minus the frontmatter and Downloads block. Defaults to the newest post;
// `--tag v4.3.1` selects one. release.yml pipes this into `--notes-file`.
import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  BLOG_DIR,
  findReleasePost,
  parseReleasePost,
  splitReleaseBody,
} from './releaseBlog.mjs'

const args = process.argv.slice(2)
const tagIdx = args.indexOf('--tag')
const tag = tagIdx === -1 ? undefined : args[tagIdx + 1]

const post = findReleasePost(tag)
const { body } = parseReleasePost(
  readFileSync(path.join(BLOG_DIR, post), 'utf8'),
  post,
)
const { notes, changelog } = splitReleaseBody(body)

process.stdout.write(`${[notes, changelog].filter(Boolean).join('\n\n')}\n`)
