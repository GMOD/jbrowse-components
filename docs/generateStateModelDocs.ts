import fs from 'fs'
import slugify from 'slugify'
import {
  rm,
  filter,
  getAllFiles,
  removeComments,
  extractWithComment,
} from './util'

interface Action {
  name: string
  docs: string
  code: string
}
interface Method {
  name: string
  docs: string
  code: string
}
interface Getter {
  name: string
  docs: string
  code: string
}
interface Property {
  name: string
  docs: string
  code: string
}

interface Model {
  name: string
  id: string
  category?: string
  docs: string
}
interface StateModel {
  model?: Model
  getters: Getter[]
  methods: Method[]
  properties: Property[]
  actions: Action[]
  filename: string
}

function generateStateModelDocs(files: string[]) {
  const cwd = `${process.cwd()}/`
  const contents = {} as Record<string, StateModel>
  extractWithComment(files, obj => {
    const fn = obj.filename
    const fn2 = fn.replace(cwd, '')
    contents[fn] ??= {
      model: undefined,
      getters: [],
      actions: [],
      methods: [],
      properties: [],
      filename: fn2,
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
      } else if (name.includes('Session')) {
        category = 'session'
      } else if (name.includes('Root')) {
        category = 'root'
      } else if (name.includes('Assembly')) {
        category = 'assemblyManagement'
      } else if (name.includes('InternetAccount')) {
        category = 'internetAccount'
      } else if (name.includes('Connection')) {
        category = 'connection'
      }
    }

    if (obj.type === 'stateModel') {
      current.model = { ...obj, name, docs, id }
    } else if (obj.type === 'getter') {
      current.getters.push({ ...obj, name, docs, code })
    } else if (obj.type === 'method') {
      current.methods.push({ ...obj, name, docs, code })
    } else if (obj.type === 'action') {
      current.actions.push({ ...obj, name, docs, code })
    } else if (obj.type === 'property') {
      current.properties.push({ ...obj, name, docs, code })
    }
  })
  return contents
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
;(async () => {
  const contents = generateStateModelDocs(await getAllFiles())

  Object.values(contents).forEach(
    ({ model, getters, properties, actions, methods, filename }) => {
      if (model) {
        const getterstr = `${getters.length ? `### ${model.name} - Getters` : ''}\n${getters

          .map(({ name, docs, signature }: any) =>
            join(
              `#### getter: ${name}`,
              docs,
              codeBlock('// type', signature || ''),
            ),
          )
          .join('\n')}`

        const methodstr = `${methods.length ? `### ${model.name} - Methods` : ''}\n${methods

          .map(({ name, docs, signature }: any) =>
            join(
              `#### method: ${name}`,
              docs,
              codeBlock('// type signature', `${name}: ${signature || ''}`),
            ),
          )
          .join('\n')}`

        const propertiesstr = `${properties.length ? `### ${model.name} - Properties` : ''}\n${properties

          .map(({ name, docs, code, signature }: any) =>
            join(
              `#### property: ${name}`,
              docs,
              codeBlock('// type signature', signature || '', '// code', code),
            ),
          )
          .join('\n')}`

        const actionstr = `${actions.length ? `### ${model.name} - Actions` : ''}\n${actions

          .map(({ name, docs, signature }: any) =>
            join(
              `#### action: ${name}`,
              docs,
              codeBlock('// type signature', `${name}: ${signature || ''}`),
            ),
          )
          .join('\n')}`

        const dir = 'website/docs/models'
        try {
          fs.mkdirSync(dir)
        } catch (e) {}
        fs.writeFileSync(
          `${dir}/${model.name}.md`,
          `---
id: ${model.id}
title: ${model.name}
---

Note: this document is automatically generated from mobx-state-tree objects in
our source code. See [Core concepts and intro to pluggable
elements](/docs/developer_guide/) for more info

### Source file

[${filename}](https://github.com/GMOD/jbrowse-components/blob/main/${filename})

${model.docs}

${propertiesstr}

${getterstr}

${methodstr}

${actionstr}

`,
        )
      }
    },
  )
})()

function codeBlock(...lines: string[]) {
  return `

\`\`\`js
${lines.join('\n')}
\`\`\`
`
}

function join(...lines: string[]) {
  return lines.join('\n\n')
}
