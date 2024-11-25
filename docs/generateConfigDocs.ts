import fs from 'fs'
import slugify from 'slugify'
import {
  rm,
  filter,
  removeComments,
  extractWithComment,
  getAllFiles,
} from './util'

interface Derives {
  name: string
  docs: string
  code: string
}
interface Id {
  name: string
  docs: string
  code: string
}
interface Conf {
  name: string
  docs: string
  category?: string
  id: string
}
interface Slot {
  name: string
  docs: string
  code: string
}
interface Config {
  derives?: Derives
  id?: Id
  slots: Slot[]
  config?: Conf
  filename: string
}

function generateConfigDocs(files: string[]) {
  const cwd = `${process.cwd()}/`
  const contents = {} as Record<string, Config>
  extractWithComment(files, obj => {
    const fn = obj.filename
    const fn2 = fn.replace(cwd, '')
    if (!contents[fn]) {
      contents[fn] = {
        derives: undefined,
        id: undefined,
        slots: [],
        config: undefined,
        filename: fn2,
      }
    }
    const current = contents[fn]
    const name = rm(obj.comment, `#${obj.type}`) || obj.name
    const docs = filter(filter(obj.comment, `#${obj.type}`), '#category')
    const code = removeComments(obj.node)
    const id = slugify(name, { lower: true })

    // category currently unused, but can organize sidebar
    let category = rm(obj.comment, '#category')

    if (!category) {
      if (name.endsWith('Adapter')) {
        category = 'adapter'
      } else if (name.endsWith('Display')) {
        category = 'display'
      } else if (name.endsWith('View')) {
        category = 'view'
      } else if (name.endsWith('Renderer')) {
        category = 'renderer'
      } else if (name.includes('Root')) {
        category = 'root'
      } else if (name.endsWith('Track')) {
        category = 'track'
      } else if (name.endsWith('InternetAccount')) {
        category = 'internetAccount'
      } else if (name.endsWith('Connection')) {
        category = 'connection'
      } else if (name.endsWith('RpcDriver')) {
        category = 'rpcDriver'
      }
    }

    if (obj.type === 'baseConfiguration') {
      current.derives = { ...obj, name, docs, code }
    } else if (obj.type === 'identifier') {
      current.id = { ...obj, name, docs, code }
    } else if (obj.type === 'slot') {
      current.slots.push({ ...obj, name, docs, code })
    } else if (obj.type === 'config') {
      current.config = { ...obj, name, docs, id, category }
    }
  })
  return contents
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
;(async () => {
  const contents = generateConfigDocs(await getAllFiles())

  Object.values(contents).forEach(
    ({ config, slots, id, derives, filename }) => {
      if (config) {
        const idstr = id
          ? `### ${config.name} - Identifier

#### slot: ${id.name}`
          : ''
        const derivesstr = derives
          ? `### ${config.name} - Derives from


${derives.docs}

\`\`\`js
${derives.code}
\`\`\`
`
          : ''
        const slotstr = `${slots.length ? `### ${config.name} - Slots` : ''}\n${slots

          .map(({ name, docs, code }: any) => {
            return `#### slot: ${name}

${docs}

\`\`\`js
${code}
\`\`\`
`
          })
          .join('\n')}`

        const dir = 'website/docs/config'
        try {
          fs.mkdirSync(dir)
        } catch (e) {}
        fs.writeFileSync(
          `${dir}/${config.name}.md`,
          `---
id: ${config.id}
title: ${config.name}
---
Note: this document is automatically generated from configuration objects in
our source code. See [Config guide](/docs/config_guide) for more info

### Source file

[${filename}](https://github.com/GMOD/jbrowse-components/blob/main/${filename})

${config.docs}

${idstr}

${slotstr}

${derivesstr}
`,
        )
      }
    },
  )
})()
