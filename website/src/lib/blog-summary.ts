const STOP_HEADING = /^(downloads|changes since|changelog|full changelog)/i
const GREETING = /^(hello|hi|hey|greetings)\b[^.!,]*[!,.]\s*/i

function stripMarkdown(text: string) {
  return text
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replaceAll(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replaceAll(/[*_`]/g, '')
    .replaceAll(/\s+/g, ' ')
    .trim()
}

function headingText(line: string) {
  return stripMarkdown(line.replace(/^#+\s*/, '')).replace(/[:.]$/, '')
}

function firstSentence(text: string) {
  const match = /^.+?(?<!\be\.g|\bi\.e)[.!?](?=\s|$)/.exec(text)
  const sentence = match ? match[0] : text
  return sentence.charAt(0).toUpperCase() + sentence.slice(1)
}

// The part of a post above its downloads and changelog: the announcement.
function announcement(body: string) {
  const lines = body.trim().split('\n')
  const stop = lines.findIndex(
    line => /^##\s/.test(line) && STOP_HEADING.test(headingText(line)),
  )
  return stop === -1 ? lines : lines.slice(0, stop)
}

function highlights(lines: string[]) {
  const h2 = lines.filter(line => /^##\s/.test(line))
  const umbrella = h2.findIndex(line => /^highlights$/i.test(headingText(line)))
  if (umbrella === -1) {
    return h2.map(headingText)
  }
  const start = lines.indexOf(h2[umbrella]!)
  const end = lines.findIndex((line, i) => i > start && /^##\s/.test(line))
  return lines
    .slice(start + 1, end === -1 ? undefined : end)
    .filter(line => /^###\s/.test(line))
    .map(headingText)
}

function lede(lines: string[]) {
  const paragraphs = lines
    .join('\n')
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(block => block && !/^(#|!\[|-\s|\*\s|```|<)/.test(block))
    .map(block => stripMarkdown(block).replace(GREETING, ''))
    .filter(text => text.length > 20)
  return paragraphs[0] ? firstSentence(paragraphs[0]) : undefined
}

function heroImage(lines: string[]) {
  const match = /!\[([^\]]*)\]\(([^)\s]+)/.exec(lines.join('\n'))
  return match ? { src: match[2]!, alt: match[1]! } : undefined
}

function isPatchRelease(id: string) {
  const version = /v?\d+\.\d+\.(\d+)(-beta)?/.exec(id)
  return version ? Boolean(version[2]) || version[1] !== '0' : false
}

// A post gets a card on the feed when its announcement shows something: a
// picture, or several highlights. Patch releases need the highlights.
export function blogSummary(id: string, body: string) {
  const lines = announcement(body)
  const summary = {
    highlights: highlights(lines),
    lede: lede(lines),
    image: heroImage(lines),
  }
  return {
    ...summary,
    featured:
      summary.highlights.length >= 2 ||
      (summary.image !== undefined && !isPatchRelease(id)),
  }
}

interface FeedInput {
  id: string
  body: string
  title: string
  date: Date
  description?: string
  href: string
}

type FeedPost = FeedInput & ReturnType<typeof blogSummary>

// Newest-first posts by year, each year's featured posts apart from the rest.
export function blogFeed(posts: FeedInput[]) {
  const years: { year: string; featured: FeedPost[]; others: FeedPost[] }[] =
    []
  for (const input of posts) {
    const summary = blogSummary(input.id, input.body)
    const post = { ...input, ...summary, lede: input.description ?? summary.lede }
    const year = input.id.slice(0, 4)
    if (years.at(-1)?.year !== year) {
      years.push({ year, featured: [], others: [] })
    }
    const current = years.at(-1)!
    if (post.featured) {
      current.featured.push(post)
    } else {
      current.others.push(post)
    }
  }
  return years
}
