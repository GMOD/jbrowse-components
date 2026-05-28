import { TAG_COLOR_PALETTE, updateColorTagMap } from './colorTagUtils.ts'

describe('updateColorTagMap', () => {
  it('returns added=true when new tags are added', () => {
    const { added } = updateColorTagMap({}, ['HP:0', 'HP:1'])
    expect(added).toBe(true)
  })

  it('returns added=false when all tags already exist', () => {
    const { map } = updateColorTagMap({}, ['HP:0', 'HP:1'])
    const { added } = updateColorTagMap(map, ['HP:0', 'HP:1'])
    expect(added).toBe(false)
  })

  it('assigns distinct colors to different tag values', () => {
    const { map } = updateColorTagMap({}, ['HP:0', 'HP:1', 'HP:2'])
    const colors = Object.values(map)
    expect(new Set(colors).size).toBe(3)
  })

  it('preserves existing color when a new tag is added alongside it', () => {
    const { map: first } = updateColorTagMap({}, ['HP:0'])
    const { map: second } = updateColorTagMap(first, ['HP:0', 'HP:1'])
    expect(second['HP:0']).toBe(first['HP:0'])
  })

  it('starts empty so first RPC sends an empty map', () => {
    expect(Object.keys(updateColorTagMap({}, []).map)).toHaveLength(0)
  })

  it('assigns colors from TAG_COLOR_PALETTE by insertion order', () => {
    const tags = ['A', 'B', 'C']
    const { map } = updateColorTagMap({}, tags)
    expect(map.A).toBe(TAG_COLOR_PALETTE[0])
    expect(map.B).toBe(TAG_COLOR_PALETTE[1])
    expect(map.C).toBe(TAG_COLOR_PALETTE[2])
  })

  it('wraps palette when more tags than palette entries', () => {
    const tags = Array.from(
      { length: TAG_COLOR_PALETTE.length + 1 },
      (_, i) => `tag:${i}`,
    )
    const { map } = updateColorTagMap({}, tags)
    expect(map[`tag:${TAG_COLOR_PALETTE.length}`]).toBe(TAG_COLOR_PALETTE[0])
  })
})
