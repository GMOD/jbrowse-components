import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'

import {
  indexSpellings,
  syntenyTrackTypes,
  trackTypes,
} from '../../products/jbrowse-img/src/makeConfigs.ts'
import { buildFullHelp } from '../../products/jbrowse-img/src/options.ts'
import { check, formatMarkdown } from './check-utils.ts'
import { docsDir, repoRoot, websiteDir } from './paths.ts'

// Mirrors products/jbrowse-img/README.md into website/docs/jbrowse-img.md so the
// @jbrowse/img static-export docs live alongside the CLI docs (cli.md). The
// README is the source of truth — edit it there, then run `pnpm autogen` (or
// this script directly) to regenerate. CI parity via `--check`.

const productDir = join(repoRoot, 'products', 'jbrowse-img')
const readmePath = join(productDir, 'README.md')
const outPath = join(docsDir, 'jbrowse-img.md')
const imgSrcDir = join(productDir, 'img')
const imgDestDir = join(websiteDir, 'static', 'img', 'jbrowse-img')

const githubBase =
  'https://github.com/GMOD/jbrowse-components/blob/main/products/jbrowse-img'

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

// Repo-relative links (data/*, scripts/*) only resolve inside the repo, so point
// them at GitHub. Absolute (http), anchor (#), and root (/) links
// are left alone. GitHub redirects /blob/ to /tree/ for directories.
function rewriteRelativeLinks(md: string) {
  return md.replaceAll(/\]\(([^)]+)\)/g, (match, target: string) => {
    const isAbsolute = /^(https?:|mailto:|#|\/)/.test(target)
    return isAbsolute ? match : `](${githubBase}/${target})`
  })
}

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

// Fill the README's INJECT_HELP marker block with the live `jb2export --help`
// output (top-level + every subcommand), so the published help reference can't
// drift from the CLI. Mirrors the COLOR_TABLE marker pattern used in the guides.
const helpStartRe =
  /(<!-- INJECT_HELP START[^>]*-->)[\s\S]*?(<!-- INJECT_HELP END -->)/

function injectHelp(md: string) {
  if (!helpStartRe.test(md)) {
    throw new Error('README is missing the INJECT_HELP marker block')
  }
  const help = buildFullHelp('jb2export', trackTypes, syntenyTrackTypes)
  // A function replacer: the help text is generated from the option
  // descriptions and defaults, so a `$&` or `$'` in one of those would be read
  // as a replacement pattern and splice the README into its own help block.
  // The two markers are put back by hand rather than through `$1`/`$2` for the
  // same reason.
  return md.replace(
    helpStartRe,
    (_match, start: string, end: string) =>
      `${start}\n\n\`\`\`\n${help}\n\`\`\`\n\n${end}`,
  )
}

// The index spellings a track flag probes for, generated from the list
// `siblingIndex` actually walks — a spelling added there appears here rather
// than being restated in prose that then goes out of date.
const indexStartRe =
  /(<!-- INJECT_INDEX_SPELLINGS START[^>]*-->)[\s\S]*?(<!-- INJECT_INDEX_SPELLINGS END -->)/

function injectIndexSpellings(md: string) {
  if (!indexStartRe.test(md)) {
    throw new Error('README is missing the INJECT_INDEX_SPELLINGS marker block')
  }
  const table = [
    '| Spelling | Written by |',
    '| -------- | ---------- |',
    ...indexSpellings.map(s => `| ${s.name} | ${s.writtenBy} |`),
  ].join('\n')
  return md.replace(
    indexStartRe,
    (_match, start: string, end: string) => `${start}\n\n${table}\n\n${end}`,
  )
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

// The generated string is compared byte-for-byte against the committed file, and
// `pnpm format` also rewrites that file — so whatever formats here has to agree
// with `pnpm format` or the two fight and `--check` oscillates. `formatMarkdown`
// runs the repo formatter itself, which is the only way to say that by
// construction; this was a prettier call, and prettier agreed with oxfmt on
// markdown by observation.
function generate() {
  // The README is the source of truth, but its help block is auto-filled from
  // the CLI. Refresh it and run it through the formatter so the injected README
  // is byte-identical to what `pnpm format` produces — then both the README and
  // the doc generated from it stay current and idempotent under --check.
  const readme = formatMarkdown(
    injectIndexSpellings(injectHelp(readFileSync(readmePath, 'utf8'))),
    readmePath,
  )
  // Drop the leading "# @jbrowse/img" H1 — the frontmatter title supplies the
  // page heading. Keep everything after it.
  const body = readme.replace(/^# @jbrowse\/img\n+/, '')
  const { out, names } = rewriteImages(body)
  const withFigures = imagesToFigures(out)
  const raw = [
    '---',
    `title: ${title}`,
    `description: ${description}`,
    '---',
    '',
    '<!-- DO NOT EDIT: autogenerated from products/jbrowse-img/README.md by',
    'website/scripts/generate-img-doc.ts — edit the README, then run',
    '`pnpm autogen` -->',
    '',
    rewriteRelativeLinks(withFigures),
  ].join('\n')
  return { md: formatMarkdown(raw, outPath), names, readme }
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

const { md, names, readme } = generate()
const staleImages = syncImages(names)

if (check) {
  const docStale = readFileSync(outPath, 'utf8') !== md
  const readmeStale = readFileSync(readmePath, 'utf8') !== readme
  if (docStale || readmeStale || staleImages.length > 0) {
    if (readmeStale) {
      console.error(`${readmePath} help block is out of date.`)
    }
    if (docStale) {
      console.error(`${outPath} is out of date.`)
    }
    if (staleImages.length > 0) {
      console.error(
        `images out of date in ${imgDestDir}: ${staleImages.join(', ')}`,
      )
    }
    console.error('Run `pnpm autogen` to regenerate.')
    process.exit(1)
  }
  console.log('jbrowse-img.md is up to date')
} else {
  writeFileSync(readmePath, readme)
  writeFileSync(outPath, md)
  console.log(`wrote ${outPath}`)
  if (staleImages.length > 0) {
    console.log(
      `copied ${staleImages.length} image(s) to ${imgDestDir}: ${staleImages.join(', ')}`,
    )
  }
}
