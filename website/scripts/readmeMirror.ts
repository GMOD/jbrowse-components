import { relative } from 'node:path'

import { formatMarkdown } from './check-utils.ts'
import { repoRoot } from './paths.ts'

// A product README mirrored into a website/docs page: the site's frontmatter,
// a do-not-edit notice naming the README, then the README's body. Unformatted;
// `writeDoc` formats it, and `readmeMirrorPage` for a caller writing it itself.
//
// The frontmatter values are plain YAML scalars, so a `: ` in one would start a
// mapping key and fail the content-collection parse.
export function readmeMirrorText({
  readmePath,
  outPath,
  title,
  description,
  editHint,
  body,
}: {
  readmePath: string
  outPath: string
  title: string
  description: string
  // How to change the page, e.g. "edit the README, then run `pnpm autogen`"
  editHint: string
  body: string
}) {
  for (const [key, value] of [
    ['title', title],
    ['description', description],
  ]) {
    if (value!.includes(': ')) {
      throw new Error(
        `${outPath}: the ${key} holds ": ", which YAML reads as a mapping key`,
      )
    }
  }
  return [
    '---',
    `title: ${title}`,
    `description: ${description}`,
    '---',
    '',
    `<!-- DO NOT EDIT: generated from ${relative(repoRoot, readmePath)};`,
    `${editHint} -->`,
    '',
    body,
  ].join('\n')
}

// The same page formatted the way `pnpm format` formats it, so a `--check`
// comparing it byte for byte compares like with like.
export function readmeMirrorPage(page: Parameters<typeof readmeMirrorText>[0]) {
  return formatMarkdown(readmeMirrorText(page), page.outPath)
}

// Repo-relative links only resolve inside the repo, so point them at GitHub.
// Absolute (http), anchor (#) and root (/) links are left alone. GitHub
// redirects /blob/ to /tree/ for a directory.
export function linkRelativeToGithub(md: string, productDir: string) {
  const base = `https://github.com/GMOD/jbrowse-components/blob/main/${relative(repoRoot, productDir)}`
  return md.replaceAll(/\]\(([^)]+)\)/g, (match, target: string) =>
    /^(https?:|mailto:|#|\/)/.test(target) ? match : `](${base}/${target})`,
  )
}
