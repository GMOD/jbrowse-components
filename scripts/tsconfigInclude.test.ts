import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import ts from 'typescript'

// The root project lists its directories instead of taking the implicit
// `**/*`, because that implicit form is what makes `--watch` spin (the reason
// is written beside the list in tsconfig.json). The list buys that at the price
// of no longer picking up a new top-level directory on its own, so this asserts
// the two select the same program: add `demos-2/` and the typecheck keeps
// covering it, or this fails naming it.

const root = join(__dirname, '..')
const configPath = join(root, 'tsconfig.json')

function fileNames(json: unknown) {
  const parsed = ts.parseJsonConfigFileContent(
    json,
    ts.sys,
    root,
    undefined,
    configPath,
  )
  expect(parsed.errors).toEqual([])
  return parsed.fileNames.map(f => f.slice(root.length + 1))
}

test('the root include selects exactly what the implicit **/* does', () => {
  const { config, error } = ts.readConfigFile(configPath, path =>
    readFileSync(path, 'utf8'),
  )
  expect(error).toBeUndefined()
  expect(config.include).toBeDefined()

  const { include: _include, ...implicit } = config
  expect(fileNames(config).sort()).toEqual(fileNames(implicit).sort())
})
