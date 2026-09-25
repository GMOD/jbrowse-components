import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { findEnginesBuiltInInitializers } from './examplesEngineHooks.ts'

function examples(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'engine-hooks-'))
  for (const [name, text] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), text)
  }
  return dir
}

test('an engine in an initializer or an effect is reported, a build function is not', () => {
  const dir = examples({
    'Initializer.tsx': `export default function A() {
  const [state] = useState(() => createViewState({ assembly }))
  return null
}`,
    'Effect.tsx': `export default function B() {
  const [state, setState] = useState()
  useEffect(() => {
    const mount = { unmounted: false }
    void (async () => {
      const response = await fetch(url)
      const config = await response.json()
      addRelativeUris(config, new URL(url))
      const plugins = await loadPlugins(config.plugins ?? [])
      if (mount.unmounted) {
        return
      }
      setState(createViewState({ config, plugins }))
    })()
    return () => {
      mount.unmounted = true
    }
  }, [])
  return null
}`,
    'BuildFunction.tsx': `// not useState(() => createViewState(opts))
async function build() {
  return createViewStateAsync({ config: await fetchConfig() })
}
export default function C() {
  const state = useCreateViewState(build)
  useEffect(() => {
    void state?.session.view.launchTrack('genes')
  }, [state])
  return null
}`,
  })
  const found = findEnginesBuiltInInitializers([dir])
    .map(v => [path.basename(v.file), v.line, v.where])
    .sort()
  expect(found).toEqual([
    ['Effect.tsx', 3, 'effect'],
    ['Initializer.tsx', 2, 'initializer'],
  ])
})
