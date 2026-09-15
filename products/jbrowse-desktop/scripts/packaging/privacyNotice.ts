// The privacy policy as the Windows installer shows it.
//
// SignPath's terms require the policy on screen during installation, and the
// text is taken from the page the website publishes rather than written again
// here — a second copy is one that goes stale without anything noticing, and
// what an installer says about data collection is the copy that must not.
//
// An installer window is a worse place to read than a web page, so it gets the
// part that is about the app: the page marks that region with
// `<!-- installer notice start -->` and `<!-- installer notice end -->`, and
// what the website has to say about its own cookie banner stays on the website,
// behind the link at the end.
//
// NSIS's license page renders a plain text file, so the markdown is flattened:
// no syntax survives, and a link becomes its text followed by an address the
// reader can type, since nothing on that page is clickable.

const START = '<!-- installer notice start -->'
const END = '<!-- installer notice end -->'
const LINK = /\[([^\]]+)\]\(([^)]+)\)/g
const HEADING = /^#{1,6}\s+/

// Hard-wrapped rather than left to the installer's own control, so the notice
// reads the same in every window it opens in.
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

function markedRegion(markdown: string) {
  const start = markdown.indexOf(START)
  const end = markdown.indexOf(END)
  if (start === -1 || end === -1 || end < start) {
    throw new Error(
      `the privacy policy has no ${START} … ${END} region, so the installer has nothing to show`,
    )
  }
  return markdown.slice(start + START.length, end)
}

/**
 * `markdown` is the published privacy policy, `siteUrl` is what its
 * root-relative links resolve against, and `policyUrl` is the whole policy,
 * which the notice ends by pointing at.
 *
 * CRLF throughout, because the RichEdit control the license page uses puts a
 * bare LF on the same visual line.
 */
export function privacyNoticeText(
  markdown: string,
  { siteUrl, policyUrl }: { siteUrl: string; policyUrl: string },
) {
  const paragraphs = markedRegion(markdown)
    .trim()
    .split(/\r?\n\s*\r?\n/)
    .map(paragraph => flatten(paragraph, siteUrl))
    .filter(Boolean)
  if (paragraphs.length === 0) {
    throw new Error('the privacy policy came out empty; the installer needs it')
  }
  const blocks = [...paragraphs, `Full privacy policy: ${policyUrl}`].map(
    paragraph => wrap(paragraph).join('\r\n'),
  )
  return `${blocks.join('\r\n\r\n')}\r\n`
}
