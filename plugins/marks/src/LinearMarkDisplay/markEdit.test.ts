import {
  addMark,
  channelScale,
  channelScales,
  scaleMember,
  withChannelScale,
  withScaleMember,
  channelEdit,
  editChannels,
  markSummary,
  moveMark,
  removeMark,
  unreadChannels,
  withChannel,
  withoutChannel,
} from './markEdit.ts'

import type { MarkSnapshot } from './markProblems.ts'
import type { PlotFields } from './scanPlotFields.ts'

const FIELDS: PlotFields = {
  numeric: ['score', 'INFO.DP'],
  categorical: ['strand', 'repClass'],
}

describe('editChannels', () => {
  it('offers a span no y, since a span stands at no value', () => {
    expect(editChannels('span')).not.toContain('y')
    expect(editChannels('bar')).toContain('y')
  })

  it('offers a point its shape and a link its size, and neither the other', () => {
    expect(editChannels('point')).toContain('shape')
    expect(editChannels('point')).not.toContain('size')
    expect(editChannels('link')).toContain('size')
    expect(editChannels('link')).not.toContain('shape')
  })
})

describe('channelEdit', () => {
  it('reads a plain field', () => {
    expect(channelEdit({ encoding: { y: 'score' } }, 'y')).toEqual({
      value: 'score',
      beyond: false,
    })
  })

  it('reads a field out of a channel object', () => {
    const mark = {
      encoding: { color: { field: 'strand', scale: 'categorical' } },
    }
    expect(channelEdit(mark as MarkSnapshot, 'color')).toEqual({
      value: 'strand',
      beyond: false,
    })
  })

  it('is empty for a channel nothing wrote', () => {
    expect(channelEdit({}, 'y')).toEqual({ value: '', beyond: false })
  })

  // The display answers a lifted snapshot, where `color: "red"` has already
  // become `{ value: 'red' }` — so the commonest colour in the tree reaches
  // the picker through the constant slot, not as a string.
  it('reads a constant the schema lifted out of a shorthand', () => {
    expect(
      channelEdit({ encoding: { color: { value: 'red' } } }, 'color'),
    ).toEqual({ value: 'red', beyond: false })
  })

  // The property that makes the form safe to open on a hand-written config.
  it('is beyond the picker where the declaration says more than a field', () => {
    const ramp = {
      encoding: {
        color: { field: 'score', scale: 'linear', domainMin: 0, range: ['a'] },
      },
    }
    expect(channelEdit(ramp as MarkSnapshot, 'color')).toEqual({
      value: '',
      beyond: true,
    })
  })

  it('is beyond the picker for a far foot naming its own sequence', () => {
    const mate = {
      encoding: { x2: { chrom: 'mate.refName', pos: 'mate.start' } },
    }
    expect(channelEdit(mate as MarkSnapshot, 'x2').beyond).toBe(true)
  })
})

describe('withChannel', () => {
  it('writes a positional channel as the field itself', () => {
    expect(withChannel({}, 'y', 'score', FIELDS).encoding).toEqual({
      y: 'score',
    })
  })

  it('gives a numeric colour field a linear scale and a text one categorical', () => {
    expect(withChannel({}, 'color', 'score', FIELDS).encoding).toEqual({
      color: { field: 'score', scale: 'linear' },
    })
    expect(withChannel({}, 'color', 'strand', FIELDS).encoding).toEqual({
      color: { field: 'strand', scale: 'categorical' },
    })
  })

  // `color: "red"` and `shape: "triangle-down"` are what a value no scan saw
  // means, so the picker writes it as the constant it is.
  it('writes a value no scan saw as a constant', () => {
    expect(withChannel({}, 'color', 'red', FIELDS).encoding).toEqual({
      color: 'red',
    })
    expect(withChannel({}, 'shape', 'triangle-down', FIELDS).encoding).toEqual({
      shape: 'triangle-down',
    })
  })

  it('clears the channel on an empty value', () => {
    const mark = { encoding: { y: 'score', row: 'hp' } }
    expect(withChannel(mark, 'y', '', FIELDS).encoding).toEqual({ row: 'hp' })
  })

  it('leaves every other channel as it was', () => {
    const mark = { mark: 'point', encoding: { y: 'score', x: 'start' } }
    expect(withChannel(mark as MarkSnapshot, 'row', 'hp', FIELDS)).toEqual({
      mark: 'point',
      encoding: { y: 'score', x: 'start', row: 'hp' },
    })
  })
})

describe('unreadChannels', () => {
  it('names a channel the type stopped reading', () => {
    const wasBar = { mark: 'span', encoding: { y: 'score' } }
    expect(unreadChannels(wasBar as MarkSnapshot)).toEqual(['y'])
  })

  it('names nothing where every channel is read', () => {
    expect(unreadChannels({ mark: 'bar', encoding: { y: 'score' } })).toEqual(
      [],
    )
  })

  it('clears one without touching the rest', () => {
    const mark = { mark: 'span', encoding: { y: 'score', color: 'red' } }
    expect(withoutChannel(mark as MarkSnapshot, 'y').encoding).toEqual({
      color: 'red',
    })
  })
})

describe('the mark list', () => {
  const marks: MarkSnapshot[] = [
    { mark: 'bar', encoding: { y: 'a' } },
    { mark: 'point', encoding: { y: 'b' } },
    { mark: 'span' },
  ]

  it('adds a mark at its defaults, which the rules then report on', () => {
    expect(addMark(marks)).toHaveLength(4)
    expect(addMark(marks).at(-1)).toEqual({})
  })

  it('removes one and keeps the order of the rest', () => {
    expect(removeMark(marks, 1).map(m => m.mark)).toEqual(['bar', 'span'])
  })

  it('moves one, since the list order is the paint order', () => {
    expect(moveMark(marks, 0, 1).map(m => m.mark)).toEqual([
      'point',
      'bar',
      'span',
    ])
    expect(moveMark(marks, 2, -1).map(m => m.mark)).toEqual([
      'bar',
      'span',
      'point',
    ])
  })

  it('refuses to move past either end', () => {
    expect(moveMark(marks, 0, -1)).toEqual(marks)
    expect(moveMark(marks, 2, 1)).toEqual(marks)
  })
})

describe('markSummary', () => {
  it('names the type and what the mark reads', () => {
    expect(
      markSummary({ mark: 'bar', encoding: { y: 'score', color: 'red' } }),
    ).toBe('bar · y score · color red')
  })

  it('falls back to the default type a mark leaves unwritten', () => {
    expect(markSummary({ encoding: { y: 'score' } })).toBe('bar · y score')
  })

  it('names a channel the picker cannot show without pretending to read it', () => {
    const ramp = {
      mark: 'bar',
      encoding: { y: 'score', color: { field: 'x', range: ['red', 'blue'] } },
    }
    expect(markSummary(ramp as MarkSnapshot)).toBe('bar · y score · color')
  })
})

describe('the scale beside a field', () => {
  const ramp = {
    encoding: { color: { field: 'score', scale: 'linear', scheme: 'viridis' } },
  }

  it('reads the kind a field is read through, and nothing for a constant', () => {
    expect(channelScale(ramp, 'color')).toBe('linear')
    expect(
      channelScale({ encoding: { color: { value: 'red' } } }, 'color'),
    ).toBe('')
  })

  it('reads a member as text, and an unset one as empty', () => {
    expect(scaleMember(ramp, 'color', 'scheme')).toBe('viridis')
    expect(scaleMember(ramp, 'color', 'domainMin')).toBe('')
  })

  // A ramp's members mean nothing under a categorical scale, and the rule list
  // would report them, so changing the kind drops what the new one cannot use.
  it('drops the members a new kind does not paint', () => {
    expect(
      withChannelScale(ramp, 'color', 'categorical').encoding!.color,
    ).toEqual({ field: 'score', scale: 'categorical' })
  })

  it('keeps the ramp members when one ramp becomes another', () => {
    expect(withChannelScale(ramp, 'color', 'log').encoding!.color).toEqual({
      field: 'score',
      scale: 'log',
      scheme: 'viridis',
    })
  })

  it('writes an end as a number and a reverse as a boolean', () => {
    expect(
      withScaleMember(ramp, 'color', 'domainMin', '0').encoding!.color,
    ).toMatchObject({ domainMin: 0 })
    expect(
      withScaleMember(ramp, 'color', 'reverse', 'true').encoding!.color,
    ).toMatchObject({ reverse: true })
  })

  it('clears a member an empty value names, so an end autoscales again', () => {
    const pinned = withScaleMember(ramp, 'color', 'domainMax', '50')
    expect(
      withScaleMember(pinned, 'color', 'domainMax', '').encoding!.color,
    ).not.toHaveProperty('domainMax')
  })

  it('leaves a ramp within the picker rather than beyond it', () => {
    expect(channelEdit(ramp, 'color')).toEqual({
      value: 'score',
      beyond: false,
    })
  })

  it('is still beyond the picker for a domain or a range', () => {
    const listed = {
      encoding: { color: { field: 'x', scale: 'categorical', range: ['red'] } },
    }
    expect(channelEdit(listed, 'color').beyond).toBe(true)
  })
})

// MarkSize is closed and has no scheme or reverse, so a width ramp keeps its
// ends across a kind change and nothing a colour ramp would.
describe('the scale beside a width', () => {
  const width = {
    mark: 'link' as const,
    encoding: { size: { field: 'score', scale: 'linear', domainMin: 1 } },
  }

  it("offers a width's two ramps", () => {
    expect(channelScales('size')).toEqual(['linear', 'log'])
  })

  it('keeps the ends when one width ramp becomes the other', () => {
    expect(withChannelScale(width, 'size', 'log').encoding!.size).toEqual({
      field: 'score',
      scale: 'log',
      domainMin: 1,
    })
  })
})
