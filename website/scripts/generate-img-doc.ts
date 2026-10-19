import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { check, checkOrWrite } from './check-utils.ts'
import { docsDir, repoRoot, websiteDir } from './paths.ts'
import { linkRelativeToGithub, readmeMirrorPage } from './readmeMirror.ts'

// Mirrors products/jbrowse-img/README.md into website/docs/jbrowse-img.md so the
// @jbrowse/img static-export docs live alongside the CLI docs (cli.md). The
// README is the source of truth, and sync-img-readme.ts fills its generated
// blocks; edit it there, then run `pnpm autogen`.

const productDir = join(repoRoot, 'products', 'jbrowse-img')
const readmePath = join(productDir, 'README.md')
const outPath = join(docsDir, 'jbrowse-img.md')
const imgSrcDir = join(productDir, 'img')
const imgDestDir = join(websiteDir, 'static', 'img', 'jbrowse-img')

// The README points its example images at the figure store, so they render on
// npm and on GitHub with no dependency on a website deploy having happened —
// see the note in sync-img-readme.ts, which generates those URLs. They were
// raw.github URLs into products/jbrowse-img/img until figure bytes left git.
//
// For the docs site we serve them from the website's own static dir instead, so
// the page is self-contained: versioned with the docs, rendering in
// offline/staging builds, with no runtime dependency on the store. Astro's
// rehype-base-urls prefixes the `/img/...` path with the site base path,
// matching every other figure on the site.
//
// The store URL carries a 12-hex content hash between the name and the
// extension, which is dropped here: on the site the figure is just
// `<name>.png`, and it is the copy generate-img-doc mirrors into static/img.
const rawImgRe =
  /https:\/\/jbrowse\.org\/jb2-figures\/jbrowse-img\/([\w-]+)\.[0-9a-f]{12}(\.\w+)/g
const localImgUrl = '/img/jbrowse-img/'

const title = 'Static image export (@jbrowse/img)'
const description =
  'Render publication-ready SVG or PNG of a JBrowse view from the command ' +
  'line, with no browser in the loop'

// Repoint raw.github image URLs at the local static dir; collect the referenced
// filenames so they can be copied/verified alongside the doc.
function rewriteImages(md: string) {
  const names = new Set<string>()
  // The hash segment between them is what gets dropped; `names` keeps the
  // extension because it names the files to mirror into static/img.
  const out = md.replaceAll(rawImgRe, (_match, name: string, ext: string) => {
    names.add(name + ext)
    return `${localImgUrl}${name}${ext}`
  })
  return { out, names }
}

// The site renders captioned figures via the <Figure> component (handled by
// remark-figure), so convert the README's plain markdown images into <Figure>s
// — the image alt text becomes the figcaption.
function imagesToFigures(md: string) {
  return md.replaceAll(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    (_match, alt: string, src: string) =>
      `<Figure src="${src}" caption="${alt}" />`,
  )
}

function generate() {
  // The frontmatter title supplies the page heading, so the README's H1 goes.
  const body = readFileSync(readmePath, 'utf8').replace(
    /^# @jbrowse\/img\n+/,
    '',
  )
  const { out, names } = rewriteImages(body)
  const md = readmeMirrorPage({
    readmePath,
    outPath,
    title,
    description,
    editHint: 'edit the README, then run `pnpm autogen`',
    body: linkRelativeToGithub(imagesToFigures(out), productDir),
  })
  return { md, names }
}

// Copy each referenced example image into the website's static dir (or, in check
// mode, list the ones that are missing/out of date so CI fails when a source
// image changed but wasn't re-synced).
function syncImages(names: Set<string>) {
  const stale: string[] = []
  for (const name of names) {
    const src = join(imgSrcDir, name)
    if (!existsSync(src)) {
      throw new Error(
        `README references ${localImgUrl}${name} but ${src} does not exist`,
      )
    }
    const dest = join(imgDestDir, name)
    const upToDate =
      existsSync(dest) && readFileSync(dest).equals(readFileSync(src))
    if (!upToDate) {
      stale.push(name)
      if (!check) {
        mkdirSync(imgDestDir, { recursive: true })
        copyFileSync(src, dest)
      }
    }
  }
  return stale
}

const { md, names } = generate()
const staleImages = syncImages(names)

if (check && staleImages.length > 0) {
  console.error(
    `images out of date in ${imgDestDir}: ${staleImages.join(', ')}. Run \`pnpm autogen\` to regenerate.`,
  )
  process.exit(1)
}
if (!check && staleImages.length > 0) {
  console.log(
    `copied ${staleImages.length} image(s) to ${imgDestDir}: ${staleImages.join(', ')}`,
  )
}
checkOrWrite({
  path: outPath,
  content: md,
  label: 'jbrowse-img.md',
  staleHint: 'run `pnpm autogen`',
})
