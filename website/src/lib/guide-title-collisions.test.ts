import { collisionLabels, guideDirLabel } from './guide-title-collisions.ts'

const autogenDirs = new Set(['config', 'models', 'api'])

test('labels both sides of a title collision by their guide directory', () => {
  const docs = [
    { id: 'config_guides/hic_track', title: 'Hi-C track' },
    { id: 'user_guides/hic_track', title: 'Hi-C track' },
  ]
  expect(collisionLabels(docs, autogenDirs)).toEqual(
    new Map([
      ['config_guides/hic_track', 'Config guide'],
      ['user_guides/hic_track', 'User guide'],
    ]),
  )
})

test('leaves an uncontested title unlabeled', () => {
  const docs = [
    { id: 'config_guides/hic_track', title: 'Hi-C track' },
    { id: 'user_guides/hic_track', title: 'Hi-C track' },
    { id: 'user_guides/gene_track', title: 'Gene track' },
  ]
  expect(collisionLabels(docs, autogenDirs).has('user_guides/gene_track')).toBe(
    false,
  )
})

test('ignores a title shared only with an autogen reference page', () => {
  const docs = [
    { id: 'config/linearhicdisplay', title: 'LinearHicDisplay' },
    { id: 'models/linearhicdisplay', title: 'LinearHicDisplay' },
  ]
  expect(collisionLabels(docs, autogenDirs).size).toBe(0)
})

test('guideDirLabel falls back to the raw directory name', () => {
  expect(guideDirLabel('user_guides')).toBe('User guide')
  expect(guideDirLabel('config_guides')).toBe('Config guide')
  expect(guideDirLabel('some_other_dir')).toBe('some_other_dir')
})
