/* eslint-disable no-console */
import slugify from 'slugify'
import { rm, filter, removeComments, extractWithComment } from './util'
import fs from 'fs'

let alreadySeen = {} as { [key: string]: boolean }
let currStateModel = ''

function write(s: string) {
  fs.appendFileSync(currStateModel, `${s}\n`)
}

function generateStateModelDocs() {
  console.log(`---
id: state_model_reference
title: State-model reference
toplevel: true
---`)

  extractWithComment(
    [
      'plugins/linear-genome-view/src/LinearGenomeView/index.tsx',
      'plugins/dotplot-view/src/DotplotView/model.ts',
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
    ],
    obj => {
      if (obj.type === 'stateModel') {
        const name = rm(obj.comment, '!stateModel') || obj.name
        const id = slugify(name, { lower: true })
        currStateModel = `website/docs/models/${id}.md`
        fs.writeFileSync(currStateModel, '')
        alreadySeen = {}

        write(`---
id: ${id}
title: ${name}
toplevel: true
---`)

        const rest = filter(obj.comment, '!stateModel')
        write('\n')
        write(rest)
      } else {
        if (alreadySeen[obj.name]) {
          return
        } else {
          alreadySeen[obj.name] = true
        }
        if (obj.type === 'getter') {
          const rest = filter(obj.comment, '!getter')
          write(`#### getter: ${obj.name}`)
          write('\n')
          write(rest)
          write('```js')
          write('// Type')
          write(obj.signature || '')
          write('```')
        } else if (obj.type === 'method') {
          write(`#### method: ${obj.name}`)

          const rest = filter(obj.comment, '!method')
          write(rest)
          write('```js')
          write('// Type signature')
          write(`${obj.name}: ${obj.signature}`)
          write('```')
        } else if (obj.type === 'action') {
          write(`#### action: ${obj.name}`)
          write('\n')

          const rest = filter(obj.comment, '!action')
          write(rest)
          write('```js')
          write('// Type signature')
          write(`${obj.name}: ${obj.signature}`)
          write('```')
        } else if (obj.type === 'property') {
          write(`#### property: ${obj.name}`)
          write('\n')
          write(obj.comment.replace('!property', ''))
          write('```js')
          write(removeComments(obj.node))
          write('```')
        }
      }
    },
  )
}
generateStateModelDocs()
