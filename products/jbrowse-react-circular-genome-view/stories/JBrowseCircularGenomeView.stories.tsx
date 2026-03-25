import { Human, ShowTrack, Volvox } from './examples/index.ts'

import HumanSource from '!!./raw-source-loader.cjs!./examples/Human.tsx'
import ShowTrackSource from '!!./raw-source-loader.cjs!./examples/ShowTrack.tsx'
import VolvoxSource from '!!./raw-source-loader.cjs!./examples/Volvox.tsx'

const sourceMap = [
  [Human, HumanSource],
  [ShowTrack, ShowTrackSource],
  [Volvox, VolvoxSource],
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

export default { title: 'Circular Genome View' }

export { Human, ShowTrack, Volvox } from './examples/index.ts'
