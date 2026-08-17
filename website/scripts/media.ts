// The media-only door onto the media store. `pnpm figures` drives BOTH stores
// and is what a regen should use; this one exists for working on clips alone.
//
//   pnpm media status          what the worktree and media.lock disagree about
//   pnpm media:pull            install every file the manifest names (no credentials)
//   pnpm media:push            upload new bytes, rewrite media.lock (needs AWS)
//   pnpm media check           CI gate: manifest and worktree agree
//
// WHY A STORE AT ALL, when the docs deploy already publishes `static/`.
//
// `update-docs.yml` runs `rclone sync dist/ s3:jbrowse.org/jb2`, and sync
// DELETES anything in the bucket that the freshly-built `dist/` does not carry.
// The bytes cannot be committed (a screencast is an undeltifiable blob git keeps
// forever, and re-filming the same tour produces different bytes every time), so
// a CI checkout has no `static/media` and the sync would delete the videos on
// the first docs push after they landed. `pnpm build` runs `figures:pull`, which
// pulls this corpus too, so the files are there when astro copies `static/` in,
// and the sync finds them.
//
// The alternative was regenerating them in the docs CI — a jbrowse-web build
// plus a headless capture on every "update docs" commit, for output that is
// non-deterministic and so re-uploads in full each time.
//
// The store's three properties are the figures': content-addressed so a key is
// never overwritten, immutable so an old revision stays fetchable at its own
// url, and public so `pull` needs no credentials. website/scripts/
// figure-store.ts is where they are argued at length. The commands themselves
// are media-commands.ts, so figures.ts can run them without running this CLI.
import { parseArgs } from 'node:util'

import {
  mediaCheck,
  mediaPull,
  mediaPush,
  mediaStatus,
} from './media-commands.ts'

const usage = `media — the S3-backed media store (see also \`pnpm figures\`, which drives both)

  status              compare the worktree against website/media.lock
  pull [--force]      install every file media.lock names
  push [--dry-run] [--filter a,b] [--allow-deletions]
                      upload new bytes, then rewrite media.lock
  check               fail if the manifest and the worktree disagree
`

const { values, positionals } = (() => {
  try {
    return parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        help: { type: 'boolean', short: 'h', default: false },
        filter: { type: 'string', multiple: true },
        'dry-run': { type: 'boolean', default: false },
        force: { type: 'boolean', default: false },
        'allow-deletions': { type: 'boolean', default: false },
      },
    })
  } catch (e) {
    console.error(`${e instanceof Error ? e.message : String(e)}\n\n${usage}`)
    process.exit(1)
  }
})()

const options = {
  filter: values.filter,
  dryRun: values['dry-run'],
  force: values.force,
  allowDeletions: values['allow-deletions'],
}

const command = positionals[0] ?? 'status'
if (values.help) {
  console.log(usage)
} else if (command === 'status') {
  mediaStatus()
} else if (command === 'pull') {
  await mediaPull(options)
} else if (command === 'push') {
  if (mediaPush(options) === 0) {
    console.error(
      `no media on disk matches --filter ${values.filter?.join(',')}`,
    )
    process.exit(1)
  }
} else if (command === 'check') {
  mediaCheck()
} else {
  console.error(`unknown command: ${command}\n\n${usage}`)
  process.exit(1)
}
