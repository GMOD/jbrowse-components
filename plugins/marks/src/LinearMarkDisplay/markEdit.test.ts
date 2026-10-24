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
    expect(editChannels('rect')).not.toContain('y')
    expect(editChannels('bar')).toContain('y')
  })

  it('offers a point its shape and size, and a stroked mark its strokeWidth', () => {
    expect(editChannels('point')).toContain('shape')
    expect(editChannels('point')).toContain('size')
    expect(editChannels('point')).not.toContain('strokeWidth')
    expect(editChannels('link')).toContain('strokeWidth')
    expect(editChannels('rule')).toContain('strokeWidth')
    expect(editChannels('line')).toContain('strokeWidth')
    expect(editChannels('link')).not.toContain('size')
    expect(editChannels('bar')).not.toContain('size')
    expect(editChannels('bar')).not.toContain('strokeWidth')
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
      encoding: { color: { field: 'strand', scale: { type: 'ordinal' } } },
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
  // become `{ value: 'red' }` — so the commonest color in the tree reaches
  // the picker through the constant slot, not as a string.
  it('reads a constant the schema lifted out of a shorthand', () => {
    expect(
      channelEdit({ encoding: { color: { value: 'red' } } }, 'color'),
    ).toEqual({ value: 'red', beyond: false })
  })

  // The property that makes the form safe to open on a hand-written config.
  it('holds a field whose scale pins ends and lists colors', () => {
    const ramp = {
      encoding: {
        color: {
          field: 'score',
          scale: { type: 'linear', domainMin: 0, range: ['a'] },
        },
      },
    }
    expect(channelEdit(ramp as MarkSnapshot, 'color')).toEqual({
      value: 'score',
      beyond: false,
    })
  })

  it('is beyond the picker for a scale or key member no control shows', () => {
    const flat = { encoding: { color: { field: 'score', scale: 'log' } } }
    expect(channelEdit(flat as DraftMark, 'color').beyond).toBe(true)
    const keyed = {
      encoding: { color: { field: 'type', legend: { orient: 'left' } } },
    }
    expect(channelEdit(keyed, 'color').beyond).toBe(true)
  })

  it('is beyond the picker for a far foot naming its own sequence', () => {
    const mate = {
      encoding: { x2: { refName: 'mate.refName', pos: 'mate.start' } },
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

  it('gives a numeric color field a linear scale and a text one ordinal', () => {
    expect(withChannel({}, 'color', 'score', FIELDS).encoding).toEqual({
      color: { field: 'score', scale: { type: 'linear' } },
    })
    expect(withChannel({}, 'color', 'strand', FIELDS).encoding).toEqual({
      color: { field: 'strand', scale: { type: 'ordinal' } },
    })
  })

  it('writes a value that spells a color or a shape as the constant', () => {
    for (const color of ['red', '#f00', 'rgb(0,0,255)']) {
      expect(withChannel({}, 'color', color, FIELDS).encoding).toEqual({
        color: { value: color },
      })
    }
    expect(withChannel({}, 'shape', 'triangle-down', FIELDS).encoding).toEqual({
      shape: { value: 'triangle-down' },
    })
  })

  // Inside `encoding` a bare string is a field, a `jexl:` expression included,
  // as a config file reads it; a constant callback is the JSON box's { value }.
  it('writes a jexl expression as a field, as a config file reads one', () => {
    const expr = 'jexl:feature.score > 5 ? "red" : "blue"'
    expect(withChannel({}, 'color', expr, FIELDS).encoding).toEqual({
      color: { field: expr, scale: { type: 'ordinal' } },
    })
  })

  it('edits a bare field as the object it lifts to, keeping the preset scale', () => {
    const bare = {
      mark: 'bar' as const,
      encoding: { y: 'score', color: 'strand' },
    }
    const object = {
      mark: 'bar' as const,
      encoding: { y: 'score', color: { field: 'strand' } },
    }
    expect(
      withChannel(bare, 'color', 'INFO.AF', FIELDS).encoding?.color,
    ).toEqual(withChannel(object, 'color', 'INFO.AF', FIELDS).encoding?.color)
    expect(withChannel(bare, 'color', 'INFO.AF', FIELDS).encoding).toEqual({
      y: 'score',
      color: { field: 'INFO.AF' },
    })
  })

  // A scan reads one window, and none has landed while it runs, so a field it
  // did not list — a dotted path, a tag, a half-typed name — is still a field.
  it('writes a value no scan saw and no constant spells as a field', () => {
    for (const field of ['tags.HP', 'scor', 'currentcolor']) {
      expect(withChannel({}, 'color', field, FIELDS).encoding).toEqual({
        color: { field, scale: { type: 'ordinal' } },
      })
    }
    expect(withChannel({}, 'shape', 'rhombus', FIELDS).encoding).toEqual({
      shape: { field: 'rhombus', scale: { type: 'ordinal' } },
    })
  })

  it('reads a scanned field as a field even where it spells a color', () => {
    const fields = { numeric: [], categorical: ['tan'] }
    expect(withChannel({}, 'color', 'tan', fields).encoding).toEqual({
      color: { field: 'tan', scale: { type: 'ordinal' } },
    })
  })

  it('reads a jexl expression over a field as the field', () => {
    const over = { encoding: { color: { field: 'strand' } } }
    expect(
      withChannel(over, 'color', 'jexl:get(feature,"hp")', FIELDS).encoding,
    ).toEqual({ color: { field: 'jexl:get(feature,"hp")' } })
  })

  it('reads a shape through ordinal, the one scale it has', () => {
    expect(withChannel({}, 'shape', 'score', FIELDS).encoding).toEqual({
      shape: { field: 'score', scale: { type: 'ordinal' } },
    })
  })

  describe('over a field read through a scale', () => {
    const ramp = {
      encoding: {
        color: {
          field: 'score',
          scale: {
            type: 'log',
            scheme: 'viridis',
            domainMin: 1,
            reverse: true,
          },
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
        color: { field: 'strand', scale: { type: 'ordinal' } },
      })
    })

    // `reads` passes through `red`, a CSS color, on its way; written against
    // the channel as the edit began, the ramp survives the detour.
    it('keeps the ramp through a constant typed on the way to a field', () => {
      const detour = withChannel(ramp, 'color', 'red', FIELDS)
      expect(detour.encoding!.color).toEqual({ value: 'red' })
      expect(
        withChannel(detour, 'color', 'reads', FIELDS, ramp.encoding.color)
          .encoding,
      ).toEqual({ color: { ...ramp.encoding.color, field: 'reads' } })
    })
  })

  it("keeps a width's scale when its field changes", () => {
    const width = {
      mark: 'link' as const,
      encoding: {
        strokeWidth: { field: 'score', scale: { type: 'log', domainMax: 9 } },
      },
    }
    expect(withChannel(width, 'strokeWidth', 'count', FIELDS).encoding).toEqual(
      {
        strokeWidth: { field: 'count', scale: { type: 'log', domainMax: 9 } },
      },
    )
    expect(
      withChannel({ mark: 'link' }, 'strokeWidth', 'count', FIELDS).encoding,
    ).toEqual({ strokeWidth: 'count' })
  })

  it('reads and writes a size typed as a number as the constant px', () => {
    const point = withChannel({ mark: 'point' }, 'size', '7', FIELDS)
    expect(point.encoding).toEqual({ size: 7 })
    expect(channelEdit(point, 'size')).toEqual({ value: '7', beyond: false })
    expect(
      withChannel({ mark: 'rule' }, 'strokeWidth', '3', FIELDS).encoding,
    ).toEqual({ strokeWidth: 3 })
    expect(
      channelEdit(
        {
          mark: 'link',
          encoding: { strokeWidth: { value: 3, field: 'score' } },
        },
        'strokeWidth',
      ),
    ).toEqual({ value: 'score', beyond: false })
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
    const wasBar = { mark: 'rect', encoding: { y: 'score' } }
    expect(unreadChannels(wasBar as MarkSnapshot)).toEqual(['y'])
  })

  it('names nothing where every channel is read', () => {
    expect(unreadChannels({ mark: 'bar', encoding: { y: 'score' } })).toEqual(
      [],
    )
  })

  it('clears one without touching the rest', () => {
    const mark = {
      mark: 'rect',
      encoding: { y: 'score', color: { value: 'red' } },
    }
    expect(withoutChannel(mark as MarkSnapshot, 'y').encoding).toEqual({
      color: { value: 'red' },
    })
  })
})

describe('the mark list', () => {
  const marks: MarkSnapshot[] = [
    { mark: 'bar', encoding: { y: 'a' } },
    { mark: 'point', encoding: { y: 'b' } },
    { mark: 'rect' },
  ]

  it('adds a mark at its defaults, which the rules then report on', () => {
    expect(addMark(marks)).toHaveLength(4)
    expect(addMark(marks).at(-1)).toEqual({})
  })

  it('removes one and keeps the order of the rest', () => {
    expect(removeMark(marks, 1).map(m => m.mark)).toEqual(['bar', 'rect'])
  })

  it('moves one, since the list order is the paint order', () => {
    expect(moveMark(marks, 0, 1).map(m => m.mark)).toEqual([
      'point',
      'bar',
      'rect',
    ])
    expect(moveMark(marks, 2, -1).map(m => m.mark)).toEqual([
      'bar',
      'rect',
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
      markSummary({
        mark: 'bar',
        encoding: { y: 'score', color: { value: 'red' } },
      }),
    ).toBe('bar · y score · color red')
  })

  it('falls back to the default type a mark leaves unwritten', () => {
    expect(markSummary({ encoding: { y: 'score' } })).toBe('bar · y score')
  })

  it('names a channel the picker cannot show without pretending to read it', () => {
    const ramp = {
      mark: 'bar',
      encoding: {
        y: 'score',
        color: { field: 'x', scale: { range: ['red', 'blue'] } },
      },
    }
    expect(markSummary(ramp as MarkSnapshot)).toBe('bar · y score · color x')
  })
})

describe('the scale beside a field', () => {
  const ramp = {
    encoding: {
      color: { field: 'score', scale: { type: 'linear', scheme: 'viridis' } },
    },
  }

  it('reads the kind a field is read through, and nothing for a constant', () => {
    expect(channelScale(ramp, 'color')).toBe('linear')
    expect(
      channelScale({ encoding: { color: { value: 'red' } } }, 'color'),
    ).toBe('')
  })

  it('shows the scale an unscaled field paints through: score a ramp', () => {
    const unscaled = (field: string) => ({ encoding: { color: { field } } })
    expect(channelScale(unscaled('score'), 'color')).toBe('linear')
    expect(channelScale(unscaled('svtype'), 'color')).toBe('ordinal')
  })

  it('reads a member as text, and an unset one as empty', () => {
    expect(scaleMember(ramp, 'color', 'scheme')).toBe('viridis')
    expect(scaleMember(ramp, 'color', 'domainMin')).toBe('')
  })

  // A ramp's members mean nothing under an ordinal scale, and the rule list
  // would report them, so changing the kind drops what the new one cannot use.
  it('drops the members a new kind does not paint', () => {
    expect(withChannelScale(ramp, 'color', 'ordinal').encoding!.color).toEqual({
      field: 'score',
      scale: { type: 'ordinal' },
    })
  })

  it("keeps an ordinal color's unknown only while it stays ordinal", () => {
    const other = {
      encoding: {
        color: { field: 'type', scale: { domain: ['a'], unknown: 'grey' } },
      },
    }
    expect(
      withChannelScale(other, 'color', 'ordinal').encoding!.color,
    ).toMatchObject({ scale: { unknown: 'grey' } })
    expect(
      withChannelScale(other, 'color', 'linear').encoding!.color,
    ).not.toHaveProperty('scale.unknown')
  })

  it('keeps the ramp members when one ramp becomes another', () => {
    expect(withChannelScale(ramp, 'color', 'log').encoding!.color).toEqual({
      field: 'score',
      scale: { type: 'log', scheme: 'viridis' },
    })
    const stops = withListMember(ramp, 'color', 'range', 'white, red')
    expect(withChannelScale(stops, 'color', 'log').encoding!.color).toEqual({
      field: 'score',
      scale: { type: 'log', scheme: 'viridis', range: ['white', 'red'] },
    })
    expect(withChannelScale(stops, 'color', 'ordinal').encoding!.color).toEqual(
      { field: 'score', scale: { type: 'ordinal' } },
    )
  })

  it('writes an end as a number and a reverse as a boolean', () => {
    expect(
      withScaleMember(ramp, 'color', 'domainMin', '0').encoding!.color,
    ).toMatchObject({ scale: { domainMin: 0 } })
    expect(
      withScaleMember(ramp, 'color', 'reverse', 'true').encoding!.color,
    ).toMatchObject({ scale: { reverse: true } })
  })

  it('clears a member an empty value names, so an end autoscales again', () => {
    const pinned = withScaleMember(ramp, 'color', 'domainMax', '50')
    expect(
      withScaleMember(pinned, 'color', 'domainMax', '').encoding!.color,
    ).not.toHaveProperty('scale.domainMax')
  })

  it('leaves a ramp within the picker rather than beyond it', () => {
    expect(channelEdit(ramp, 'color')).toEqual({
      value: 'score',
      beyond: false,
    })
  })

  it('edits a domain and a range beside the field', () => {
    const listed = {
      encoding: {
        color: { field: 'x', scale: { type: 'ordinal', range: ['red'] } },
      },
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
      scale: { type: 'threshold', domain: ['0.5', '0.9'] },
    })
    expect(withListMember(cut, 'color', 'domain', ' ').encoding?.color).toEqual(
      { field: 'x', scale: { type: 'threshold' } },
    )
  })

  it("keeps a key's title across a change of scale", () => {
    const titled = withScaleMember(ramp, 'color', 'title', 'Score')
    expect(titled.encoding?.color).toMatchObject({ legend: { title: 'Score' } })
    expect(
      withChannelScale(titled, 'color', 'ordinal').encoding?.color,
    ).toEqual({
      field: 'score',
      scale: { type: 'ordinal' },
      legend: { title: 'Score' },
    })
  })

  // An unset member and a part left empty are no member, so a cleared key
  // writes the channel the config would snapshot.
  it('drops a part its last member leaves empty', () => {
    const titled = withScaleMember(ramp, 'color', 'title', 'Score')
    expect(
      withScaleMember(titled, 'color', 'title', '').encoding?.color,
    ).toEqual(ramp.encoding.color)
  })
})

// MarkSize is closed and has no scheme or reverse, so a width ramp keeps its
// ends across a kind change and nothing a color ramp would.
describe('the scale beside a width', () => {
  const width = {
    mark: 'link' as const,
    encoding: {
      strokeWidth: { field: 'score', scale: { type: 'linear', domainMin: 1 } },
    },
  }

  it("offers a width's two ramps", () => {
    expect(channelScales('strokeWidth')).toEqual(['linear', 'log'])
    expect(channelScales('size')).toEqual(['linear', 'log'])
  })

  it('reads a shorthand width as a field on the preset ramp, which a kind change keeps', () => {
    const shorthand = {
      mark: 'link' as const,
      encoding: { strokeWidth: 'score' },
    }
    expect(channelScale(shorthand, 'strokeWidth')).toBe('linear')
    expect(
      withChannelScale(shorthand, 'strokeWidth', 'log').encoding!.strokeWidth,
    ).toEqual({ field: 'score', scale: { type: 'log' } })
  })

  it('keeps the ends and the widths when one width ramp becomes the other', () => {
    expect(
      withChannelScale(width, 'strokeWidth', 'log').encoding!.strokeWidth,
    ).toEqual({ field: 'score', scale: { type: 'log', domainMin: 1 } })
    const widths = withListMember(width, 'strokeWidth', 'range', '1, 9')
    expect(widths.encoding!.strokeWidth).toEqual({
      field: 'score',
      scale: { type: 'linear', domainMin: 1, range: [1, 9] },
    })
    expect(
      withChannelScale(widths, 'strokeWidth', 'log').encoding!.strokeWidth,
    ).toEqual({
      field: 'score',
      scale: { type: 'log', domainMin: 1, range: [1, 9] },
    })
  })
})

// LocusZoom's key is written through the same members a config writes, so a
// Manhattan plot colored by LD opens in the form rather than the JSON box.
test('a channel shaping its key stays in the form, and each key member round-trips', () => {
  const mark: DraftMark = {
    mark: 'point',
    encoding: {
      y: 'score',
      color: {
        field: 'r2',
        scale: { type: 'threshold', domain: ['0.5'], range: ['blue', 'red'] },
        legend: { descending: true, missingLabel: 'No LD data' },
      },
      shape: {
        field: 'ld_role',
        scale: { names: ['Index SNP'] },
        legend: { values: ['index'], title: '' },
      },
    },
  }
  expect(channelEdit(mark, 'color').beyond).toBe(false)
  expect(channelEdit(mark, 'shape').beyond).toBe(false)
  expect(scaleMember(mark, 'color', 'descending')).toBe('true')
  expect(listMember(mark, 'shape', 'values')).toBe('index')
  expect(listMember(mark, 'shape', 'names')).toBe('Index SNP')
  expect(
    withScaleMember(mark, 'color', 'descending', '').encoding?.color,
  ).not.toHaveProperty('legend.descending')
  expect(
    withScaleMember(mark, 'color', 'missingLabel', 'unjoined').encoding?.color,
  ).toMatchObject({ legend: { missingLabel: 'unjoined' } })
  expect(
    withListMember(mark, 'shape', 'values', 'index, other').encoding?.shape,
  ).toMatchObject({ legend: { values: ['index', 'other'], title: '' } })
  expect(
    withChannelScale(mark, 'color', 'ordinal').encoding?.color,
  ).toMatchObject({ legend: { missingLabel: 'No LD data' } })
})
