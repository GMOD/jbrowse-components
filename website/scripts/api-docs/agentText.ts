// The compact form of a type page an agent reads through JBrowse Desktop's
// `docs` tool: one line per member, first paragraph of its prose, no HTML and
// no links to follow. The website page is the full account; this is what fits
// beside a hundred other things in a model's context window.

const MAX_PROSE_CHARS = 240
const MAX_CODE_CHARS = 160
const MAX_EXAMPLE_CHARS = 1600

export function firstParagraph(
  text: string | undefined,
  max = MAX_PROSE_CHARS,
) {
  const paragraph = (text ?? '')
    .split(/\n\s*\n/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .find(p => p.length > 0)
  if (paragraph === undefined) {
    return ''
  }
  if (paragraph.length <= max) {
    return paragraph
  }
  const cut = paragraph.slice(0, max)
  const atWord = cut.lastIndexOf(' ')
  return `${(atWord > max / 2 ? cut.slice(0, atWord) : cut).trimEnd()}…`
}

export function flatCode(code: string | undefined, max = MAX_CODE_CHARS) {
  const flat = (code ?? '').replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`
}

// `- \`name(sig)\`: prose` — the backticks are what separates a signature that
// itself contains colons from the sentence after it
export function memberLine(name: string, code: string, docs: string) {
  const head = code ? `\`${name}${code}\`` : `\`${name}\``
  const prose = firstParagraph(docs)
  return prose ? `- ${head}: ${prose}` : `- ${head}`
}

// An authored #example is already markdown — prose around its own fenced
// snippets — so it passes through; only its length is bounded
export function exampleBlock(content: string | undefined) {
  const text = (content ?? '').trim()
  return text.length <= MAX_EXAMPLE_CHARS
    ? text
    : `${text.slice(0, MAX_EXAMPLE_CHARS)}\n… (example truncated)`
}

export function pluginOf(filename: string) {
  const plugin = /(?:^|\/)plugins\/([^/]+)\//.exec(filename)?.[1]
  return plugin ? `${plugin} plugin` : 'core'
}

export function agentPage(
  title: string,
  intro: (string | false | undefined)[],
  sections: { heading: string; lines: string[] }[],
) {
  return [
    `# ${title}`,
    ...intro.filter((s): s is string => Boolean(s)),
    ...sections
      .filter(s => s.lines.length > 0)
      .map(s => `## ${s.heading}\n${s.lines.join('\n')}`),
  ].join('\n\n')
}
