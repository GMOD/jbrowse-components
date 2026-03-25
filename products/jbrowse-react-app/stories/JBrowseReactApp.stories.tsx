import {
  BasicExample,
  DarkTheme,
  HumanDemo,
  SyntenyExample,
  WithFetchConfigJson,
  WithImportConfigJson,
  WithLaunchLinearGenomeView,
  WithWebWorker,
} from './examples/index.ts'

import BasicExampleSource from '!!./raw-source-loader.cjs!./examples/BasicExample.tsx'
import DarkThemeSource from '!!./raw-source-loader.cjs!./examples/DarkTheme.tsx'
import HumanDemoSource from '!!./raw-source-loader.cjs!./examples/HumanDemo.tsx'
import SyntenyExampleSource from '!!./raw-source-loader.cjs!./examples/SyntenyExample.tsx'
import WithFetchConfigJsonSource from '!!./raw-source-loader.cjs!./examples/WithFetchConfigJson.tsx'
import WithImportConfigJsonSource from '!!./raw-source-loader.cjs!./examples/WithImportConfigJson.tsx'
import WithLaunchLinearGenomeViewSource from '!!./raw-source-loader.cjs!./examples/WithLaunchLinearGenomeView.tsx'
import WithWebWorkerSource from '!!./raw-source-loader.cjs!./examples/WithWebWorker.tsx'

const sourceMap = [
  [BasicExample, BasicExampleSource],
  [DarkTheme, DarkThemeSource],
  [HumanDemo, HumanDemoSource],
  [SyntenyExample, SyntenyExampleSource],
  [WithFetchConfigJson, WithFetchConfigJsonSource],
  [WithImportConfigJson, WithImportConfigJsonSource],
  [WithLaunchLinearGenomeView, WithLaunchLinearGenomeViewSource],
  [WithWebWorker, WithWebWorkerSource],
] as const

for (const [story, sourceCode] of sourceMap) {
  const fileName = `${story.name}.tsx`
  Object.assign(story, {
    parameters: {
      storyFile: fileName,
      docs: { source: { code: sourceCode, language: 'tsx' } },
    },
  })
}

export default { title: 'Source code for examples' }

export {
  BasicExample,
  DarkTheme,
  HumanDemo,
  SyntenyExample,
  WithFetchConfigJson,
  WithImportConfigJson,
  WithLaunchLinearGenomeView,
  WithWebWorker,
} from './examples/index.ts'
