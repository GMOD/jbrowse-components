import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { writeDoc } from './api-docs/format.ts'
import { docsDir, repoRoot } from './paths.ts'
import { linkRelativeToGithub, readmeMirrorText } from './readmeMirror.ts'

// Mirrors products/jbrowse-capture/README.md into website/docs/jbrowse-capture.md,
// the same way generate-img-doc.ts handles jbrowse-img. The README is the
// source of truth.

const productDir = join(repoRoot, 'products', 'jbrowse-capture')
const readmePath = join(productDir, 'README.md')
const outPath = join(docsDir, 'jbrowse-capture.md')

export function writeCaptureDoc() {
  // The frontmatter title supplies the page heading, so the README's H1 goes.
  return writeDoc(
    outPath,
    readmeMirrorText({
      readmePath,
      outPath,
      title: 'Screenshot a live view (@jbrowse/capture)',
      description:
        'Drive a live JBrowse 2 instance with Puppeteer and screenshot it once it ' +
        'has actually finished rendering',
      editHint: 'edit the README, then run `pnpm autogen`',
      body: linkRelativeToGithub(
        readFileSync(readmePath, 'utf8').replace(/^# @jbrowse\/capture\n+/, ''),
        productDir,
      ),
    }),
  )
}
