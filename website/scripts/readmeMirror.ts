import { relative } from 'node:path'

import { formatMarkdown } from './check-utils.ts'
import { repoRoot } from './paths.ts'

// A product README mirrored into a website/docs page: the site's frontmatter,
// a do-not-edit notice naming the README, then the README's body, formatted the
// way `pnpm format` formats the page so `--check` compares like with like.
//
// The frontmatter values are plain YAML scalars, so a `: ` in one would start a
// mapping key and fail the content-collection parse.
export function readmeMirrorPage({
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
  const raw = [
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
  return formatMarkdown(raw, outPath)
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
