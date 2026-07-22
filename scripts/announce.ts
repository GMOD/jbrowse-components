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
import { fileURLToPath } from 'node:url'

import {
  REPO,
  findReleasePost,
  parseReleaseFilename,
  parseReleasePost,
  splitReleaseBody,
} from './releaseBlog.ts'

const BLOG_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../website/blog',
)

const MASTODON_INSTANCE =
  process.env.MASTODON_INSTANCE ?? 'https://genomic.social'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const tagIdx = args.indexOf('--tag')
const tagArg = tagIdx === -1 ? undefined : args[tagIdx + 1]

// --tag selects the post, so notes and URLs describe the same release.
const post = findReleasePost(tagArg, BLOG_DIR)
const { body, title } = parseReleasePost(
  readFileSync(path.join(BLOG_DIR, post), 'utf8'),
  post,
)
const { y, m, d, slug, tag } = parseReleaseFilename(post)

// Summary only (before "## Downloads"), not the full changelog.
const { notes } = splitReleaseBody(body)

const releaseUrl = `https://github.com/${REPO}/releases/tag/${tag}`
const blogUrl = `https://jbrowse.org/jb2/blog/${y}/${m}/${d}/${slug}/`

// Minimal markdown -> HTML: paragraphs, bullets, links, bold, code, headings.
function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function inline(s: string) {
  // Alternation handles [text](url) and bare URLs in one pass: a markdown link
  // is consumed whole before its inner URL can match as bare.
  return s
    .replaceAll(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<]+)/g,
      (_, text: string, url: string, bare: string) =>
        bare ? `<a href="${bare}">${bare}</a>` : `<a href="${url}">${text}</a>`,
    )
    .replaceAll(/`([^`]+)`/g, '<code>$1</code>')
    .replaceAll(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

function mdToHtml(md: string) {
  const lines = escapeHtml(md).split('\n')
  const html: string[] = []
  let para: string[] = []
  let list: string[] = []
  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(para.join(' '))}</p>`)
      para = []
    }
  }
  const flushList = () => {
    if (list.length) {
      html.push(`<ul>${list.map(li => `<li>${inline(li)}</li>`).join('')}</ul>`)
      list = []
    }
  }
  // Notes are prose-wrapped, so a non-blank line that isn't a bullet or
  // heading continues whichever block is open.
  for (const line of lines) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const heading = /^(#{2,4})\s+(.*)$/.exec(line)
    if (bullet) {
      flushPara()
      list.push(bullet[1] ?? '')
    } else if (heading) {
      flushPara()
      flushList()
      const level = (heading[1] ?? '').length
      html.push(`<h${level}>${inline(heading[2] ?? '')}</h${level}>`)
    } else if (line.trim() === '') {
      flushPara()
      flushList()
    } else if (list.length) {
      // pop/push rather than indexing, so the last element is a plain string
      const last = list.pop()
      list.push(`${last} ${line.trim()}`)
    } else {
      para.push(line.trim())
    }
  }
  flushPara()
  flushList()
  return html.join('\n')
}

// Compose the messages.
const socialText = `JBrowse ${tag} is out! Release notes and downloads: ${releaseUrl}`
const subject = `JBrowse ${tag} released`
const htmlBody = `<h1>JBrowse ${tag}</h1>
${mdToHtml(notes)}
<p><a href="${releaseUrl}">Full release notes and downloads →</a></p>`
const textBody = `${notes}\n\nFull release notes and downloads: ${releaseUrl}`

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
  const enc = new TextEncoder()
  const byteStart = enc.encode(
    socialText.slice(0, socialText.indexOf(releaseUrl)),
  ).length
  const facets = [
    {
      index: {
        byteStart,
        byteEnd: byteStart + enc.encode(releaseUrl).length,
      },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: releaseUrl }],
    },
  ]
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

if (process.env.BLUESKY_APP_PASSWORD) {
  if (dryRun) {
    console.log('\n[dry-run] would post to Bluesky')
  } else {
    await postBluesky()
  }
} else {
  console.log('  – Bluesky skipped (no BLUESKY_APP_PASSWORD)')
}

if (process.env.MASTODON_ACCESS_TOKEN) {
  if (dryRun) {
    console.log('[dry-run] would post to Mastodon')
  } else {
    await postMastodon()
  }
} else {
  console.log('  – Mastodon skipped (no MASTODON_ACCESS_TOKEN)')
}

if (process.env.NEWSLETTER_LAMBDA) {
  if (dryRun) {
    console.log('[dry-run] would invoke newsletter Lambda')
  } else {
    sendNewsletter()
  }
} else {
  console.log('  – Newsletter skipped (no NEWSLETTER_LAMBDA)')
}
