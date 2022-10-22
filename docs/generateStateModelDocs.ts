import slugify from 'slugify'
import { rm, filter, removeComments, extractWithComment } from './util'
import fs from 'fs'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const contents = {} as { [key: string]: any }

function generateStateModelDocs() {
  extractWithComment(
    [
      'plugins/linear-genome-view/src/LinearGenomeView/index.tsx',
      'plugins/dotplot-view/src/DotplotView/model.ts',
      'plugins/dotplot-view/src/DotplotDisplay/stateModelFactory.ts',
      'plugins/linear-comparative-view/src/LinearSyntenyView/model.ts',
      'plugins/linear-comparative-view/src/LinearComparativeView/model.ts',
      'packages/core/pluggableElementTypes/models/BaseDisplayModel.tsx',
      'plugins/alignments/src/LinearAlignmentsDisplay/models/model.tsx',
      'plugins/linear-genome-view/src/BaseLinearDisplay/models/BaseLinearDisplayModel.tsx',
      'plugins/alignments/src/LinearPileupDisplay/model.ts',
      'plugins/alignments/src/LinearSNPCoverageDisplay/models/model.ts',
      'plugins/wiggle/src/LinearWiggleDisplay/models/model.tsx',
      'plugins/linear-genome-view/src/LinearBareDisplay/model.ts',
      'plugins/linear-genome-view/src/LinearBasicDisplay/model.ts',
      'plugins/circular-view/src/CircularView/models/CircularView.ts',
      'plugins/circular-view/src/BaseChordDisplay/models/BaseChordDisplayModel.ts',
      'plugins/variants/src/LinearVariantDisplay/model.ts',
      'plugins/variants/src/ChordVariantDisplay/models/ChordVariantDisplay.ts',
      'products/jbrowse-web/src/sessionModelFactory.ts',
    ],

    obj => {
      const fn = obj.filename
      if (!contents[fn]) {
        contents[obj.filename] = {
          model: undefined,
          getters: [],
          actions: [],
          methods: [],
          properties: [],
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
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (extra: any, type: string) => {
      // this extra filter is needed because e.g. references anywhere to
      // view.bpPerPx in LinearPileupDisplay will try to output the property
      // bpPerPx in the LinearPileupDisplay doc. since we have this, we have to
      // make sure that document comments are on actual functions like
      // stateModelFactory, can't just comment `const Model` unfortunately
      return extra.comment.includes(type)
    },
  )
}
generateStateModelDocs()

Object.entries(contents).forEach(([key, value]) => {
  const { model, getters, properties, actions, methods } = value
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
      `website/docs/models/${model.id}.md`,
      `---
id: ${model.id}
title: ${model.name}
toplevel: true
---
${model.docs}



${propertiesstr}

${getterstr}

${methodstr}

${actionstr}
 
`,
    )
  }
})
