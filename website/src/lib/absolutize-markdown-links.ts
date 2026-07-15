// Raw doc markdown references other pages/images with root-relative URLs like
// `/docs/...` or `/img/...` (the base path and origin are added at render
// time). When the page is copied for pasting elsewhere (e.g. into an LLM),
// rewrite those to fully-qualified URLs so the links stay valid off-site.
export function absolutizeMarkdownLinks(markdown: string, origin: string) {
  const inline = markdown.replaceAll(/(\]\(\s*)\/(?!\/)/g, `$1${origin}/`)
  return inline.replaceAll(/^(\s*\[[^\]]+\]:\s+)\/(?!\/)/gm, `$1${origin}/`)
}
