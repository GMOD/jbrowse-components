// The pure half of announce.ts: turning release notes into the shapes each
// channel wants. Split out because announce.ts sends on import — it authenticates
// and posts at module scope — so nothing in it can be imported by a test, and
// this is the part with the arithmetic. Covered by announceFormat.test.ts.

// Minimal markdown -> HTML for the newsletter: paragraphs, bullets, links,
// bold, code, headings.
export function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function inline(s: string) {
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

export function mdToHtml(md: string) {
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

// Bluesky renders a post as plain text; a URL is only clickable if a facet
// points at it. The facet's index is a **byte** range into the UTF-8 encoding
// of the post, not a JS string index, and the two diverge on any character
// outside the BMP or, for byteStart, on any non-ASCII character at all earlier
// in the text. A wrong range does not error — it underlines the wrong slice, or
// silently drops the link.
//
// So the offsets are measured, never assumed, and this returns the facet list
// the record wants rather than leaving the arithmetic at the call site.
export function linkFacets(text: string, url: string) {
  const idx = text.indexOf(url)
  if (idx === -1) {
    return []
  }
  const enc = new TextEncoder()
  const byteStart = enc.encode(text.slice(0, idx)).length
  return [
    {
      index: { byteStart, byteEnd: byteStart + enc.encode(url).length },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }],
    },
  ]
}

// The four messages a release goes out as. One function so the release URL and
// the notes can't disagree between channels — every caller gets the same tag.
export function composeAnnouncement({
  tag,
  notes,
  releaseUrl,
}: {
  tag: string
  notes: string
  releaseUrl: string
}) {
  return {
    socialText: `JBrowse ${tag} is out! Release notes and downloads: ${releaseUrl}`,
    subject: `JBrowse ${tag} released`,
    htmlBody: `<h1>JBrowse ${tag}</h1>
${mdToHtml(notes)}
<p><a href="${releaseUrl}">Full release notes and downloads →</a></p>`,
    textBody: `${notes}\n\nFull release notes and downloads: ${releaseUrl}`,
  }
}
