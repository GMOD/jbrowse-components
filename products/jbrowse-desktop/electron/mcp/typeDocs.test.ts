import { lookupTypeDoc, typeIndex } from './typeDocs.ts'

const pages = {
  models: {
    LinearGenomeView: { category: 'View', text: '# LinearGenomeView model' },
    LinearBasicDisplay: { category: 'Display', text: '# LBD model' },
  },
  configs: {
    LinearBasicDisplay: { category: 'Display', text: '# LBD config' },
    BamAdapter: { category: 'Adapter', text: '# BamAdapter config' },
  },
}

describe('lookupTypeDoc', () => {
  it('reads a prefixed topic, case-insensitively', () => {
    expect(lookupTypeDoc(pages, 'config:bamadapter')).toEqual({
      text: '# BamAdapter config',
    })
  })

  it('prefers the model for a bare name that has both', () => {
    expect(lookupTypeDoc(pages, 'LinearBasicDisplay')).toEqual({
      text: '# LBD model',
    })
    expect(lookupTypeDoc(pages, 'config:LinearBasicDisplay')).toEqual({
      text: '# LBD config',
    })
  })

  it('falls through to the config for a bare name with no model', () => {
    expect(lookupTypeDoc(pages, 'BamAdapter')).toEqual({
      text: '# BamAdapter config',
    })
  })

  it('names near matches on a miss', () => {
    expect(lookupTypeDoc(pages, 'model:Linear')).toEqual({
      error: expect.stringContaining('model:LinearGenomeView'),
    })
  })

  it('is undefined for a bare topic that resembles no type', () => {
    expect(lookupTypeDoc(pages, 'zzz')).toBeUndefined()
  })
})

it('typeIndex groups names by category on one line each', () => {
  const index = typeIndex(pages)
  expect(index).toContain('Display models: LinearBasicDisplay')
  expect(index).toContain('View models: LinearGenomeView')
  expect(index).toContain('Adapter configs: BamAdapter')
  expect(index).toContain('Display configs: LinearBasicDisplay')
})
