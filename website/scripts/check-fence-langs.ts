// Every fenced code block in the docs and blog names a language rehype-shiki
// can highlight, or `text` for output and plain listings. A bare fence or a
// misspelled label renders as uncolored text and nothing else notices.
// Generated pages (config/, models/) take their fences from plugin JSDoc, so a
// problem there is fixed in the source.
//
// Run: `pnpm check-fence-langs`
import { readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import { resolveLang } from '../src/lib/rehype-shiki.ts'
import { docFiles, reportProblems } from './check-utils.ts'
import { docsDir, websiteDir } from './paths.ts'

const parser = unified().use(remarkParse)

const problems = [...docFiles(docsDir), ...docFiles(join(websiteDir, 'blog'))]
  .sort()
  .flatMap(file => {
    const found: string[] = []
    visit(parser.parse(readFileSync(file, 'utf8')), 'code', node => {
      const where = `${relative(websiteDir, file)}:${node.position?.start.line}`
      if (!node.lang) {
        found.push(
          `${where}: fence has no language (use \`text\` for plain output)`,
        )
      } else if (node.lang !== 'text' && !resolveLang(node.lang)) {
        found.push(`${where}: shiki has no grammar for \`${node.lang}\``)
      }
    })
    return found
  })

reportProblems(problems, 'Every fence names a language shiki highlights')
