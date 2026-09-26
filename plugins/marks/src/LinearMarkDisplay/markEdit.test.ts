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
  listMember,
  withListMember,
} from './markEdit.ts'

import type { DraftMark } from './markEdit.ts'
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
  it('holds a field whose scale pins ends and lists colours', () => {
    const ramp = {
      encoding: {
        color: { field: 'score', scale: 'linear', domainMin: 0, range: ['a'] },
      },
    }
    expect(channelEdit(ramp as MarkSnapshot, 'color')).toEqual({
      value: 'score',
      beyond: false,
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

  it('writes a value that spells a colour or a shape as the constant', () => {
    for (const color of ['red', '#f00', 'rgb(0,0,255)', 'jexl:"red"']) {
      expect(withChannel({}, 'color', color, FIELDS).encoding).toEqual({
        color,
      })
    }
    expect(withChannel({}, 'shape', 'triangle-down', FIELDS).encoding).toEqual({
      shape: 'triangle-down',
    })
  })

  // A scan reads one window, and none has landed while it runs, so a field it
  // did not list — a dotted path, a tag, a half-typed name — is still a field.
  it('writes a value no scan saw and no constant spells as a field', () => {
    for (const field of ['tags.HP', 'scor', 'currentcolor']) {
      expect(withChannel({}, 'color', field, FIELDS).encoding).toEqual({
        color: { field, scale: 'categorical' },
      })
    }
    expect(withChannel({}, 'shape', 'rhombus', FIELDS).encoding).toEqual({
      shape: { field: 'rhombus', scale: 'categorical' },
    })
  })

  it('reads a scanned field as a field even where it spells a colour', () => {
    const fields = { numeric: [], categorical: ['tan'] }
    expect(withChannel({}, 'color', 'tan', fields).encoding).toEqual({
      color: { field: 'tan', scale: 'categorical' },
    })
  })

  it('reads a jexl expression over a field as the field', () => {
    const over = { encoding: { color: { field: 'strand' } } }
    expect(
      withChannel(over, 'color', 'jexl:get(feature,"hp")', FIELDS).encoding,
    ).toEqual({ color: { field: 'jexl:get(feature,"hp")' } })
  })

  it('reads a shape through categorical, the one scale it has', () => {
    expect(withChannel({}, 'shape', 'score', FIELDS).encoding).toEqual({
      shape: { field: 'score', scale: 'categorical' },
    })
  })

  describe('over a field read through a scale', () => {
    const ramp = {
      encoding: {
        color: {
          field: 'score',
          scale: 'log',
          scheme: 'viridis',
          domainMin: 1,
          reverse: true,
        },
      },
    }

    it('keeps the scale and its members when the field changes', () => {
      expect(withChannel(ramp, 'color', 'INFO.DP', FIELDS).encoding).toEqual({
        color: { ...ramp.encoding.color, field: 'INFO.DP' },
      })
      expect(withChannel(ramp, 'color', 'tags.XY', FIELDS).encoding).toEqual({
        color: { ...ramp.encoding.color, field: 'tags.XY' },
      })
    })

    it('takes the scale a field the scan types the other way implies', () => {
      expect(withChannel(ramp, 'color', 'strand', FIELDS).encoding).toEqual({
        color: { field: 'strand', scale: 'categorical' },
      })
    })

    // `reads` passes through `red`, a CSS colour, on its way; written against
    // the channel as the edit began, the ramp survives the detour.
    it('keeps the ramp through a constant typed on the way to a field', () => {
      const detour = withChannel(ramp, 'color', 'red', FIELDS)
      expect(detour.encoding!.color).toBe('red')
      expect(
        withChannel(detour, 'color', 'reads', FIELDS, ramp.encoding.color)
          .encoding,
      ).toEqual({ color: { ...ramp.encoding.color, field: 'reads' } })
    })

    it('starts afresh over a field painted through none', () => {
      const none = {
        encoding: { color: { field: 'score', scale: 'none', value: 'red' } },
      }
      expect(withChannel(none, 'color', 'strand', FIELDS).encoding).toEqual({
        color: { field: 'strand', scale: 'categorical', value: 'red' },
      })
    })
  })

  it("keeps a width's scale when its field changes", () => {
    const width = {
      mark: 'link' as const,
      encoding: { size: { field: 'score', scale: 'log', domainMax: 9 } },
    }
    expect(withChannel(width, 'size', 'count', FIELDS).encoding).toEqual({
      size: { field: 'count', scale: 'log', domainMax: 9 },
    })
    expect(
      withChannel({ mark: 'link' }, 'size', 'count', FIELDS).encoding,
    ).toEqual({ size: 'count' })
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
    expect(markSummary(ramp as MarkSnapshot)).toBe('bar · y score · color x')
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

  it('edits a domain, a range and the labels beside the field', () => {
    const listed = {
      encoding: { color: { field: 'x', scale: 'categorical', range: ['red'] } },
    }
    expect(channelEdit(listed, 'color').beyond).toBe(false)
    expect(listMember(listed, 'color', 'range')).toBe('red')
    const cut = withListMember(
      withChannelScale(listed, 'color', 'threshold'),
      'color',
      'domain',
      '0.5, , 0.9',
    )
    expect(cut.encoding?.color).toEqual({
      field: 'x',
      scale: 'threshold',
      domain: ['0.5', '0.9'],
    })
    expect(withListMember(cut, 'color', 'domain', ' ').encoding?.color).toEqual(
      { field: 'x', scale: 'threshold' },
    )
  })

  it("keeps a key's title across a change of scale", () => {
    const titled = withScaleMember(ramp, 'color', 'title', 'Score')
    expect(
      withChannelScale(titled, 'color', 'categorical').encoding?.color,
    ).toEqual({ field: 'score', scale: 'categorical', title: 'Score' })
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

  it('reads a shorthand width as a field on the preset ramp, which a kind change keeps', () => {
    const shorthand = { mark: 'link' as const, encoding: { size: 'score' } }
    expect(channelScale(shorthand, 'size')).toBe('linear')
    expect(withChannelScale(shorthand, 'size', 'log').encoding!.size).toEqual({
      field: 'score',
      scale: 'log',
    })
  })

  it('keeps the ends when one width ramp becomes the other', () => {
    expect(withChannelScale(width, 'size', 'log').encoding!.size).toEqual({
      field: 'score',
      scale: 'log',
      domainMin: 1,
    })
  })
})

// LocusZoom's key is written through the same members a config writes, so a
// Manhattan plot coloured by LD opens in the form rather than the JSON box.
test('a channel shaping its key stays in the form, and each key member round-trips', () => {
  const mark: DraftMark = {
    mark: 'point',
    encoding: {
      y: 'score',
      color: {
        field: 'ld',
        scale: 'threshold',
        domain: ['0.5'],
        range: ['blue', 'red'],
        descending: true,
        missingLabel: 'No LD data',
      },
      shape: {
        field: 'ld_role',
        breaks: ['index'],
        labels: ['Index SNP'],
        title: '',
      },
    },
  }
  expect(channelEdit(mark, 'color').beyond).toBe(false)
  expect(channelEdit(mark, 'shape').beyond).toBe(false)
  expect(scaleMember(mark, 'color', 'descending')).toBe('true')
  expect(listMember(mark, 'shape', 'breaks')).toBe('index')
  expect(
    withScaleMember(mark, 'color', 'descending', '').encoding?.color,
  ).not.toHaveProperty('descending')
  expect(
    withScaleMember(mark, 'color', 'missingLabel', 'unjoined').encoding?.color,
  ).toMatchObject({ missingLabel: 'unjoined' })
  expect(
    withChannelScale(mark, 'color', 'categorical').encoding?.color,
  ).toMatchObject({ missingLabel: 'No LD data' })
})
