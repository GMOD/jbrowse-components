/* eslint-disable no-console */
import { extractWithComment } from './util'

const alreadySeen = {} as { [key: string]: { [key: string]: boolean } }
let currStateModel = ''
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
      if (alreadySeen[currStateModel]?.[obj.name]) {
        return
      }
      if (obj.type === 'stateModel') {
        currStateModel = obj.name
        alreadySeen[currStateModel] = {}
        const name = obj.comment
          .split('\n')
          .find(x => x.includes('!stateModel'))
          ?.replace('!stateModel', '')
          .trim()

        const rest = obj.comment
          .split('\n')
          .filter(x => !x.includes('!stateModel'))
          .join('\n')

        console.log(`## ${name || obj.name}`)
        console.log('\n')
        console.log(rest)
        console.log('\n')
      } else {
        if (alreadySeen[currStateModel]) {
          alreadySeen[currStateModel][obj.name] = true
        }
        if (obj.type === 'getter') {
          const rest = obj.comment
            .split('\n')
            .filter(x => !x.includes('!getter'))
            .join('\n')
          console.log(`#### getter: ${obj.name}`)
          console.log('\n')
          console.log(rest)
          console.log('\n')
          console.log('```js')
          console.log('// Type')
          console.log(obj.signature)
          console.log('```')
        } else if (obj.type === 'method') {
          console.log(`#### method: ${obj.name}`)
          console.log('\n')

          const rest = obj.comment
            .split('\n')
            .filter(x => !x.includes('!method'))
            .join('\n')
          console.log('\n')
          console.log(rest)
          console.log('\n')
          console.log('```js')
          console.log('// Type signature')
          console.log(`${obj.name}: ${obj.signature}`)
          console.log('```')
        } else if (obj.type === 'action') {
          console.log(`#### action: ${obj.name}`)
          console.log('\n')

          const rest = obj.comment
            .split('\n')
            .filter(x => !x.includes('!action'))
            .join('\n')
          console.log(rest)
          console.log('```js')

          console.log('// Type signature')
          console.log(`${obj.name}: ${obj.signature}`)
          console.log('```')
        } else if (obj.type === 'property') {
          console.log(`#### property: ${obj.name}`)
          console.log('\n')
          console.log('```js')
          console.log(obj.node)
          console.log('```')
        }
      }
    },
  )
}
generateStateModelDocs()
