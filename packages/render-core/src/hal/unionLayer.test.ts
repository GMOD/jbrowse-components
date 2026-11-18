import { spanMark } from '../marks/spanMark.ts'
import * as layerOverShader from '../shaders/layerOver.generated.ts'
import { layerOverId, uncomposited, withLayerOver } from './unionLayer.ts'

const BLOCK = { x: 0, y: 0, w: 101, h: 40 }

describe('uncomposited', () => {
  it('leaves a rect alone that nothing composited', () => {
    expect(uncomposited(BLOCK, [])).toEqual(BLOCK)
  })

  // Blocks meeting mid-pixel: the left one ends on column 100 rounded up, the
  // right one starts on it rounded down.
  it('trims the column a block before it composited', () => {
    expect(uncomposited({ x: 100, y: 0, w: 60, h: 40 }, [BLOCK])).toEqual({
      x: 101,
      y: 0,
      w: 59,
      h: 40,
    })
  })

  it('trims the column a block after it composited', () => {
    expect(uncomposited(BLOCK, [{ x: 100, y: 0, w: 60, h: 40 }])).toEqual({
      x: 0,
      y: 0,
      w: 100,
      h: 40,
    })
  })

  it('leaves nothing of a rect composited whole', () => {
    expect(uncomposited(BLOCK, [BLOCK])).toBeUndefined()
  })

  it('keeps blocks apart that share no column', () => {
    const right = { x: 104, y: 0, w: 60, h: 40 }
    expect(uncomposited(right, [BLOCK])).toEqual(right)
  })

  // A strip inside the column trims nothing: it is not the height of what it
  // overlaps, and a draw scissored to it is past the contract.
  it('trims only where the earlier rect spans its height', () => {
    const tall = { x: 100, y: 0, w: 60, h: 40 }
    expect(uncomposited(tall, [{ ...BLOCK, h: 20 }])).toEqual(tall)
  })
})

describe('withLayerOver', () => {
  const span = spanMark.pass

  it('adds nothing for passes that are not union', () => {
    expect(withLayerOver([span])).toEqual([span])
  })

  it('adds one composite per union pass, sampling under its own id', () => {
    const union = {
      ...span,
      id: 'line#1',
      blendState: { op: 'union' } as const,
    }
    const passes = withLayerOver([span, union])
    expect(passes.map(p => p.id)).toEqual([
      span.id,
      'line#1',
      layerOverId('line#1'),
    ])
    const over = passes[2]!
    expect(over.blendState).toEqual(layerOverShader.BLEND_STATE)
    expect(over.textures?.map(t => [t.name, t.filter])).toEqual([
      ['layer', 'nearest'],
    ])
  })
})
