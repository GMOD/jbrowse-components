import slugify from 'slugify'
import {
  rm,
  filter,
  getAllFiles,
  removeComments,
  extractWithComment,
} from './util'
import fs from 'fs'

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
  const cwd = process.cwd() + '/'
  const contents = {} as { [key: string]: StateModel }
  extractWithComment(files, obj => {
    const fn = obj.filename
    const fn2 = fn.replace(cwd, '')
    if (!contents[fn]) {
      contents[obj.filename] = {
        model: undefined,
        getters: [],
        actions: [],
        methods: [],
        properties: [],
        filename: fn2,
      }
    }
    const current = contents[fn]
    const name = rm(obj.comment, '#' + obj.type) || obj.name
    const docs = filter(obj.comment, '#' + obj.type)
    const code = removeComments(obj.node)
    const id = slugify(name, { lower: true })

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
        const getterstr =
          `${getters.length ? `### ${model.name} - Getters` : ''}\n` +
          getters
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map(({ name, docs, signature }: any) => {
              return `#### getter: ${name}

${docs}

\`\`\`js
// type
${signature || ''}
\`\`\`
`
            })
            .join('\n')

        const methodstr =
          `${methods.length ? `### ${model.name} - Methods` : ''}\n` +
          methods
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map(({ name, docs, signature }: any) => {
              return `#### method: ${name}

${docs}

\`\`\`js
// type signature
${name}: ${signature || ''}
\`\`\`
`
            })
            .join('\n')

        const propertiesstr =
          `${properties.length ? `### ${model.name} - Properties` : ''}\n` +
          properties
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map(({ name, docs, code, signature }: any) => {
              return `#### property: ${name}

${docs}

\`\`\`js
// type signature
${signature || ''}
// code
${code}
\`\`\`
`
            })
            .join('\n')

        const actionstr =
          `${actions.length ? `### ${model.name} - Actions` : ''}\n` +
          actions
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map(({ name, docs, signature }: any) => {
              return `#### action: ${name}

${docs}

\`\`\`js
// type signature
${name}: ${signature || ''}
\`\`\`
`
            })
            .join('\n')

        fs.writeFileSync(
          `website/docs/models/${model.name}.md`,
          `---
id: ${model.id}
title: ${model.name}
toplevel: true
---


Note: this document is automatically generated from mobx-state-tree objects in
our source code. See [Core concepts and intro to pluggable
elements](/docs/developer_guide/) for more info



## Source file

[${filename}](https://github.com/GMOD/jbrowse-components/blob/main/${filename})


## Docs


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
