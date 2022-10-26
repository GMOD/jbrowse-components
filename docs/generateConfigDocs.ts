import slugify from 'slugify'
import {
  rm,
  filter,
  removeComments,
  extractWithComment,
  getAllFiles,
} from './util'
import fs from 'fs'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const contents = {} as { [key: string]: any }

async function generateConfigDocs(files: string[]) {
  extractWithComment(files, obj => {
    const fn = obj.filename
    if (!contents[fn]) {
      contents[fn] = {
        derives: undefined,
        id: undefined,
        slots: [],
        config: undefined,
      }
    }
    const current = contents[fn]
    const name = rm(obj.comment, '#' + obj.type) || obj.name
    const docs = filter(obj.comment, '#' + obj.type)
    const code = removeComments(obj.node)
    const id = slugify(name, { lower: true })
    if (obj.type === 'baseConfiguration') {
      current.derives = { ...obj, name, docs, code }
    } else if (obj.type === 'identifier') {
      current.id = { ...obj, name, docs, code }
    } else if (obj.type === 'slot') {
      current.slots.push({ ...obj, name, docs, code })
    } else if (obj.type === 'config') {
      current.config = { ...obj, name, docs, id }
    }
  })
}

;(async () => {
  generateConfigDocs(await getAllFiles())

  Object.values(contents).forEach(({ config, slots, id, derives }) => {
    if (config) {
      const idstr = id
        ? `### ${config.name} - Identifier

#### slot: ${id.name}`
        : ''
      const derivesstr = derives
        ? `## ${config.name} - Derives from


${derives.docs}

\`\`\`js
${derives.code}
\`\`\`
`
        : ''
      const slotstr =
        `${slots.length ? `### ${config.name} - Slots` : ''}\n` +
        slots
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map(({ name, docs, code }: any) => {
            return `#### slot: ${name}

${docs}

\`\`\`js
${code}
\`\`\`
`
          })
          .join('\n')

      fs.writeFileSync(
        `website/docs/config/${config.id}.md`,
        `---
id: ${config.id}
title: ${config.name}
toplevel: true
---
${config.docs}

${idstr}



${slotstr}

${derivesstr}
 
`,
      )
    }
  })
})()
