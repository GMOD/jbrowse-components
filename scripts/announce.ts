#!/usr/bin/env node
// Announce a release to Bluesky, Mastodon, and the email newsletter. Fires
// automatically from announce.yml when a release is published; `pnpm announce`
// runs it locally.
//
//   pnpm announce -- --dry-run       # preview, send nothing
//   pnpm announce -- --tag v4.3.1    # pick a release
//
// A channel is attempted only when its credentials are in the env:
//   BLUESKY_IDENTIFIER, BLUESKY_APP_PASSWORD      -> Bluesky
//   MASTODON_ACCESS_TOKEN (+ MASTODON_INSTANCE)   -> Mastodon
//   NEWSLETTER_LAMBDA (+ AWS creds in env)        -> email newsletter
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { composeAnnouncement, linkFacets } from './announceFormat.ts'
import { REPO, splitReleaseBody, stripImages } from './releaseBlog.ts'
import { loadReleasePost } from './releaseCli.ts'

const MASTODON_INSTANCE =
  process.env.MASTODON_INSTANCE ?? 'https://genomic.social'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')

// One post supplies the notes, the date parts and the tag, so the prose and
// every URL below describe the same release rather than two adjacent ones.
const { body, title, y, m, d, slug, tag } = loadReleasePost(args)

// Summary only (before "## Downloads"), not the full changelog, and prose only
// — mdToHtml has no image case, so a figure would go out as literal markdown.
const notes = stripImages(splitReleaseBody(body).notes)

const releaseUrl = `https://github.com/${REPO}/releases/tag/${tag}`
const blogUrl = `https://jbrowse.org/jb2/blog/${y}/${m}/${d}/${slug}/`

const { socialText, subject, htmlBody, textBody } = composeAnnouncement({
  tag,
  notes,
  releaseUrl,
})

console.log(`Announcing ${tag}${dryRun ? ' (DRY RUN — nothing sent)' : ''}`)
console.log(`  title:   ${title}`)
console.log(`  release: ${releaseUrl}`)
console.log(`  blog:    ${blogUrl}`)

// Bluesky (AT Protocol) — with a link facet so the URL is clickable.
async function postBluesky() {
  const identifier = process.env.BLUESKY_IDENTIFIER
  const password = process.env.BLUESKY_APP_PASSWORD
  const call = async <T>(method: string, payload: unknown, jwt?: string) => {
    const res = await fetch(`https://bsky.social/xrpc/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      throw new Error(`bluesky ${method}: ${res.status} ${await res.text()}`)
    }
    return res.json() as Promise<T>
  }
  const facets = linkFacets(socialText, releaseUrl)
  const { accessJwt, did } = await call<{ accessJwt: string; did: string }>(
    'com.atproto.server.createSession',
    { identifier, password },
  )
  const res = await call<{ uri: string }>(
    'com.atproto.repo.createRecord',
    {
      repo: did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text: socialText,
        facets,
        createdAt: new Date().toISOString(),
      },
    },
    accessJwt,
  )
  console.log(`  ✓ Bluesky: ${res.uri}`)
}

// Mastodon (REST) — POST a status.
async function postMastodon() {
  const token = process.env.MASTODON_ACCESS_TOKEN
  const res = await fetch(`${MASTODON_INSTANCE}/api/v1/statuses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ status: socialText }),
  })
  if (!res.ok) {
    throw new Error(`mastodon: ${res.status} ${await res.text()}`)
  }
  const json = (await res.json()) as { url: string }
  console.log(`  ✓ Mastodon: ${json.url}`)
}

// Newsletter — invoke the send Lambda via the AWS CLI.
function sendNewsletter() {
  const fn = process.env.NEWSLETTER_LAMBDA
  if (!fn) {
    throw new Error('NEWSLETTER_LAMBDA is not set')
  }
  // The stack is in us-east-1; pin it so a local run with another default
  // region still finds the function.
  const region = process.env.AWS_REGION ?? 'us-east-1'
  const payload = { subject, htmlBody, textBody }
  const payloadFile = path.join(tmpdir(), `announce-payload-${tag}.json`)
  const outFile = path.join(tmpdir(), `announce-response-${tag}.json`)
  writeFileSync(payloadFile, JSON.stringify(payload))
  execFileSync(
    'aws',
    [
      'lambda',
      'invoke',
      '--function-name',
      fn,
      '--region',
      region,
      '--payload',
      `fileb://${payloadFile}`,
      outFile,
    ],
    { stdio: 'inherit' },
  )
  console.log(`  ✓ Newsletter: ${readFileSync(outFile, 'utf8')}`)
}

// Fan out to whatever is configured.
if (dryRun) {
  console.log(`\n--- social post ---\n${socialText}`)
  console.log(`\n--- email subject ---\n${subject}`)
  console.log(`\n--- email html ---\n${htmlBody}`)
}

// Each channel runs even if an earlier one failed. These are three independent
// sends with no transaction between them, and a throw partway used to take the
// remaining channels down with it — leaving the only fix a re-run that posts
// again to whichever channels had already succeeded. Failures are collected and
// reported at the end, so the run is still red and it names what to retry (with
// the credentials for the channels that already went out unset).
const failures: string[] = []

// Every credential a channel needs, not just one of them: gating Bluesky on
// the password alone meant a run with the password but no BLUESKY_IDENTIFIER
// looked configured, then failed inside createSession with a bare 400 naming
// neither the channel nor the missing secret.
async function channel(
  name: string,
  credentials: string[],
  send: () => void | Promise<void>,
) {
  const missing = credentials.filter(c => !process.env[c])
  if (missing.length > 0) {
    console.log(`  – ${name} skipped (no ${missing.join(', ')})`)
    return
  }
  if (dryRun) {
    console.log(`[dry-run] would send to ${name}`)
    return
  }
  try {
    await send()
  } catch (e) {
    console.error(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`)
    failures.push(name)
  }
}

await channel(
  'Bluesky',
  ['BLUESKY_IDENTIFIER', 'BLUESKY_APP_PASSWORD'],
  postBluesky,
)
await channel('Mastodon', ['MASTODON_ACCESS_TOKEN'], postMastodon)
await channel('Newsletter', ['NEWSLETTER_LAMBDA'], sendNewsletter)

if (failures.length > 0) {
  console.error(`\nFailed to announce on: ${failures.join(', ')}`)
  process.exit(1)
}
