import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

import { hostedGenome } from '../src/lib/hosted-genome.ts'
import { isAddassembly } from '../src/lib/remark-config-cli-tabs.ts'
import { docsMatching } from './check-utils.ts'
import { docRelative, docsDir } from './paths.ts'

const parser = unified().use(remarkParse)

function assemblyName(json: string) {
  try {
    const parsed: unknown = JSON.parse(json)
    return typeof parsed === 'object' &&
      parsed !== null &&
      'name' in parsed &&
      typeof parsed.name === 'string'
      ? parsed.name
      : undefined
  } catch {
    return undefined
  }
}

// Every `addassembly` fence tagged `genome=`, with the assembly name its JSON
// gives, for gen-hosted-configs to digest each hub and check-config-blocks to
// hold the name to it.
export function hostedGenomeFences() {
  return docsMatching(docsDir, /addassembly[^\n]*\bgenome=/).flatMap(
    ({ file, text }) => {
      const found: { where: string; genome: string; name?: string }[] = []
      visit(parser.parse(text), 'code', node => {
        const genome = isAddassembly(node) ? hostedGenome(node.meta) : undefined
        if (genome !== undefined) {
          found.push({
            where: `${docRelative(file)}:${node.position?.start.line ?? 0}`,
            genome,
            name: assemblyName(node.value),
          })
        }
      })
      return found
    },
  )
}
