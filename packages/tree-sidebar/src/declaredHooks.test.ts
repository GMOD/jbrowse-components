import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(__dirname, '../../..')

const DISPLAY_MODELS = [
  'plugins/canvas/src/LinearMultiRowFeatureDisplay/model.ts',
  'plugins/variants/src/LinearMultiSampleVariantDisplay/model.ts',
  'plugins/wiggle/src/LinearWiggleDisplay/model.ts',
  'plugins/maf/src/LinearMafDisplay/stateModel.ts',
  'plugins/marks/src/LinearMarkDisplay/model.ts',
]

function read(file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8')
}

// Each member the mixin declares, and whether its doc offers it as a hook.
function mixinMembers() {
  const src = read('packages/tree-sidebar/src/TreeSidebarMixin.ts')
  const members = new Map<string, boolean>()
  for (const m of src.matchAll(
    /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*\n {6}(?:get )?([A-Za-z_]\w*)\(/g,
  )) {
    members.set(m[2]!, m[1]!.includes('Overridable'))
  }
  return members
}

function definedMembers(src: string) {
  return new Set(
    [...src.matchAll(/^\s+(?:get )?([A-Za-z_]\w*)\([^)]*\)[^{\n]*\{/gm)].map(
      m => m[1]!,
    ),
  )
}

test('a display overrides only the members the mixin declares as hooks', () => {
  const members = mixinMembers()
  expect(members.get('discoveredRows')).toBe(true)
  for (const hook of ['sources', 'treeRoot', 'drawsTree']) {
    expect(members.get(hook)).toBe(true)
  }
  expect(members.get('hierarchy')).toBe(false)
  expect(members.get('rowsContentHeight')).toBe(false)
  const undeclared = DISPLAY_MODELS.flatMap(file =>
    [...definedMembers(read(file))]
      .filter(name => members.get(name) === false)
      .map(name => `${file}: ${name}`),
  )
  expect(undeclared).toEqual([])
})
