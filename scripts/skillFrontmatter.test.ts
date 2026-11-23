import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const skillsDir = join(__dirname, '..', '.claude', 'skills')

// An agent sees a skill only through its frontmatter's name and description.
// A plain YAML scalar holding ": " fails to parse, and the agent then sees the
// skill's H1 alone, with none of the trigger words.
function frontmatter(dir: string) {
  const text = readFileSync(join(skillsDir, dir, 'SKILL.md'), 'utf8')
  const [, head = ''] = text.split(/^---$/m)
  const name = /^name: (.*)$/m.exec(head)?.[1]
  const [firstLine = '', ...lines] = head
    .slice(head.indexOf('description:') + 'description:'.length)
    .split('\n')
  const blockScalar = /^ *[>|]/.test(firstLine)
  const end = lines.findIndex(line => !line.startsWith(' '))
  const continuation = end === -1 ? lines : lines.slice(0, end)
  const description = (
    blockScalar ? continuation : [firstLine, ...continuation]
  )
    .join(' ')
    .replaceAll(/\s+/g, ' ')
    .trim()
  return { name, description, blockScalar }
}

const dirs = readdirSync(skillsDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory())
  .map(entry => entry.name)

describe('skill frontmatter', () => {
  for (const dir of dirs) {
    it(dir, () => {
      const { name, description, blockScalar } = frontmatter(dir)
      expect(name).toBe(dir)
      expect(description.length).toBeGreaterThan(0)
      expect(description.length).toBeLessThanOrEqual(1024)
      if (!blockScalar) {
        expect(description).not.toMatch(/: | #/)
      }
    })
  }
})
