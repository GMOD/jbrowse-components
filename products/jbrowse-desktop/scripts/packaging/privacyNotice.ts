// The privacy policy as the Windows installer shows it.
//
// SignPath's terms require the policy on screen during installation, and the
// text is taken from the page the website publishes rather than written again
// here — a second copy is one that goes stale without anything noticing, and
// what an installer says about data collection is the copy that must not.
//
// NSIS's license page renders a plain text file, so the markdown is flattened:
// no syntax survives, and a link becomes its text followed by an address the
// reader can type, since nothing on that page is clickable.

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/
const LINK = /\[([^\]]+)\]\(([^)]+)\)/g
const HEADING = /^#{1,6}\s+/

// Wide enough to read, narrow enough for the license control at its default
// size — which does not wrap, it scrolls sideways.
const WIDTH = 76

function flatten(paragraph: string, siteUrl: string) {
  return paragraph
    .split('\n')
    .map(line => line.replace(HEADING, '').trim())
    .join(' ')
    .replaceAll(LINK, (_, text: string, href: string) =>
      href.startsWith('#') ? text : `${text} (${absolute(href, siteUrl)})`,
    )
    .replaceAll('`', '')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

function absolute(href: string, siteUrl: string) {
  return href.startsWith('/') ? `${siteUrl}${href}` : href
}

// Greedy, and a word longer than the width gets its own line rather than being
// broken: the long words here are URLs, and a URL split across two lines is one
// nobody can retype.
function wrap(paragraph: string) {
  const lines: string[] = []
  let line = ''
  for (const word of paragraph.split(' ')) {
    if (line === '') {
      line = word
    } else if (line.length + 1 + word.length <= WIDTH) {
      line += ` ${word}`
    } else {
      lines.push(line)
      line = word
    }
  }
  if (line !== '') {
    lines.push(line)
  }
  return lines
}

/**
 * `markdown` is the published privacy policy; `siteUrl` is what its
 * root-relative links resolve against.
 *
 * CRLF throughout, because the RichEdit control the license page uses puts a
 * bare LF on the same visual line.
 */
export function privacyNoticeText(
  markdown: string,
  { siteUrl }: { siteUrl: string },
) {
  const paragraphs = markdown
    .replace(FRONTMATTER, '')
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map(paragraph => flatten(paragraph, siteUrl))
    .filter(Boolean)
  if (paragraphs.length === 0) {
    throw new Error('the privacy policy came out empty; the installer needs it')
  }
  const blocks = paragraphs.map(paragraph => wrap(paragraph).join('\r\n'))
  return `${blocks.join('\r\n\r\n')}\r\n`
}
