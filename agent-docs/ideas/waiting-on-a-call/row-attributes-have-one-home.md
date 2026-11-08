---
name: row-attributes-have-one-home
description: Row displays get per-row attributes three ways (samples TSV, a wiggle subadapter's `group`, `rows.groups` regexes), so `facet`, `rows.filter`, `rows.color` and `rows.labels` read them by three rules. Proposes one `rows.data` table keyed by row name. Read before adding an attribute source, variant `groups` or attribute labels.
---

# Row attributes have one home

ADR-257 put every row-axis setting under `rows`, but the attributes those
settings read about a row still arrive three ways, one per display family:

| Display | Where a row's attributes come from | What can be written |
| --- | --- | --- |
| variant | the adapter's samples TSV (`samplesTsvLocation`), one column per attribute | any column; config cannot add one |
| wiggle | each subadapter's own fields (`group`, `color`, `name`) on `MultiWiggleAdapter` | the fields a subadapter entry spells |
| the mark family | `rows.groups`, `[{ match, group }]` regexes over the row name | the `group` attribute alone |

`facet`, `rows.filter`, `rows.color` and `rows.labels` then read "a row
attribute" by whichever rule the display has, so the same config means
different things across displays, and two of the three cannot state an
attribute in config beyond `group`.

## Proposal

One `rows.data` on every row display: a table keyed by row name, one column per
attribute, the same shape the samples TSV already is.

```js
rows: {
  data: {
    population: { HG002: 'EUR', HG005: 'EAS' },
    group: [{ match: '^CLUP', value: 'Wolf' }, { match: '^CLAT', value: 'Coyote' }],
  },
}
```

- A column is either a map from row name to value or a list of
  `{ match, value }` entries, the first matching entry filling it, which is
  what `rows.groups` is today for its one column. `rows.groups` becomes a
  deprecated spelling of `rows.data.group`.
- The adapter's attributes (samples TSV, subadapter fields) are the layer
  below: a `rows.data` column overrides the file's column of the same name,
  row by row.
- `facet`, `rows.filter`, `rows.color.field` and a future labels-from-attribute
  read a column by one rule on every display, and `jbrowse validate` can see
  the attributes a config states, where today it sees only `group`
  (ADR-257's validator note).

This lands two of ADR-257's Parked items as one mechanism: labels from a row
attribute (`rows.labels` reading a column, or a `label` column), and groups as
predicate entries (`{ field, oneOf | match, group }`), which the `{ match,
value }` column form covers without a second grammar.

## Gaps a reviewer raised that this would close

- **No way to pick every `HP1` row across samples.** `rows.kept` lists row
  names, `rows.filter` refuses `HP` (a row's identity, ADR-257), and the
  variant display takes no `groups`. A haplotype column in `rows.data`, or a
  `{ match: ' HP1$', value: 'paternal' }` entry, is an attribute `rows.filter`
  can test.
- **Wiggle's `rows.field` cannot make one row per subtrack attribute.** The
  field is `''` or `source`; subtracks sharing a `group` cannot share a row.
  With attributes in one table, a `rows.field` naming a column would be the
  same question as `facet` naming one, though a row then draws several
  subtracks, which the wiggle display does not do today.
- **The mark display over a multi-wiggle cannot facet by a file's `group`.**
  `MultiWiggleAdapter.listRowSources` lists name, label and color, all that
  core's `ListedRowSource` carries, so the subadapter's `group` never reaches
  a row display reading the listing.

## What it waits on

The call is whether `rows.data` replaces `rows.groups` outright (beta-only, so
no lift, per ADR-257's Rejected row on deprecated lifts) and whether the
samples TSV's columns become readable as `rows.data` from config, which moves
the variant display's attribute source from adapter to display. The wiggle
row-per-attribute half needs its own decision on what one row of several
subtracks draws.
