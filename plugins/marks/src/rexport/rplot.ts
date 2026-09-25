/**
 * A typed model of a ggplot, and the renderer that turns it into R.
 *
 * Emitting R by pasting strings puts every mistake past the compiler and into
 * the figure, where the script exits 0 and the picture is quietly wrong.
 * R_EXPORT.md §"The typed plot model" has the three bugs this shape refuses.
 */

export type Geom =
  | 'rect'
  | 'col'
  | 'line'
  | 'area'
  | 'segment'
  | 'point'
  | 'text'
  | 'curve'
  | 'blank'

export type Aesthetic =
  | 'x'
  | 'y'
  | 'xmin'
  | 'xmax'
  | 'ymin'
  | 'ymax'
  | 'xend'
  | 'yend'
  | 'fill'
  | 'colour'
  | 'shape'
  | 'size'
  | 'linewidth'
  | 'alpha'
  | 'label'

/** Which aesthetic a geom takes its colour through. */
export function colourAesthetic(geom: Geom): 'fill' | 'colour' {
  return geom === 'rect' || geom === 'col' || geom === 'area'
    ? 'fill'
    : 'colour'
}

/**
 * An R expression over a frame's columns — `row + 0.8`, `(start + end) / 2`.
 * Tagged so a column name and an expression cannot be confused, which is what
 * would let a typo past `Aes<C>`.
 */
export interface RExpr {
  readonly expr: string
}

export function expr(e: string): RExpr {
  return { expr: e }
}

export type Aes<C extends string> = Partial<Record<Aesthetic, C | RExpr>>

/**
 * A data frame the script builds: the variable it lands in, the columns it is
 * then known to have, and the statements producing it. `statements` ends by
 * producing the frame's value; the renderer supplies the binding.
 */
export interface RFrame<C extends string = string> {
  name: string
  columns: readonly C[]
  packages: readonly string[]
  statements: string
}

export function frame<const C extends string>(f: {
  name: string
  columns: readonly C[]
  packages?: readonly string[]
  statements: string
}): RFrame<C> {
  return { packages: [], ...f }
}

export interface Layer {
  geom: Geom
  frame: RFrame
  aes: Aes<string>
  /** Aesthetics set to a literal, outside `aes()`. */
  constants?: Partial<Record<Aesthetic, string | number>>
  /** A geom's own arguments, which are not aesthetics — `curvature`. */
  params?: Record<string, string | number>
}

/**
 * One layer, its `aes` checked against the columns of the frame it reads.
 *
 * `NoInfer` is what makes the check bite: without it TypeScript infers `C`
 * from the aes as well as the frame and unions both, so a typo widens `C` to
 * admit itself and the call typechecks.
 */
export function layer<C extends string>(l: {
  geom: Geom
  frame: RFrame<C>
  aes: Aes<NoInfer<C>>
  constants?: Partial<Record<Aesthetic, string | number>>
  params?: Record<string, string | number>
}): Layer {
  return l
}

export type Scale =
  | { kind: 'manual'; values: Record<string, string>; name?: string }
  | { kind: 'linewidth'; range: [number, number]; name?: string }
  | { kind: 'linewidthLog'; range: [number, number]; name?: string }
  | { kind: 'gradient'; colours: string[]; log?: boolean; name?: string }
  | { kind: 'steps'; colours: string[]; breaks: number[]; name?: string }
  | { kind: 'identity' }
  | { kind: 'log' }
  | { kind: 'reverse' }

export interface Plot {
  layers: Layer[]
  /** At most one scale per aesthetic, which is all ggplot has. */
  scales?: Partial<Record<Aesthetic, Scale>>
  labs?: Partial<Record<Aesthetic | 'title', string | null>>
  /** Split into one panel per value of this column. */
  facetBy?: string
  /**
   * Pin the x range so stacked panels line up. Without it each panel takes its
   * range from its own data and three panels drawn for one locus show three
   * different loci.
   */
  xlim?: { start: number; end: number }
  ylim?: { min?: number; max?: number }
  legend?: boolean
}

export function packagesFor(plot: Plot) {
  const libs = new Set(['ggplot2'])
  for (const l of plot.layers) {
    for (const pkg of l.frame.packages) {
      libs.add(pkg)
    }
  }
  return [...libs].sort()
}

function renderAes(aes: Aes<string>) {
  return Object.entries(aes)
    .map(([k, v]) => `${k} = ${typeof v === 'string' ? v : v.expr}`)
    .join(', ')
}

function renderConstant(key: string, v: string | number) {
  if (typeof v === 'number') {
    return String(v)
  }
  return rStr(key === 'fill' || key === 'colour' ? rColour(v) : v)
}

function renderLayer(l: Layer, primary: string) {
  const parts = [
    ...(l.frame.name === primary ? [] : [`data = ${l.frame.name}`]),
    `aes(${renderAes(l.aes)})`,
    ...Object.entries({ ...l.constants, ...l.params }).map(
      ([k, v]) => `${k} = ${renderConstant(k, v)}`,
    ),
  ]
  const args = parts.join(', ')
  return args.length > 60
    ? `geom_${l.geom}(\n    ${parts.join(',\n    ')})`
    : `geom_${l.geom}(${args})`
}

function renderScale(aesthetic: Aesthetic, s: Scale) {
  const suffix = aesthetic
  // A shape scale hands out R `pch` codes, which are numbers; every other
  // manual scale hands out colours, which are strings.
  const value = (v: string) => (aesthetic === 'shape' ? v : rStr(rColour(v)))
  if (s.kind === 'reverse') {
    return `scale_${aesthetic}_reverse()`
  }
  if (s.kind === 'log') {
    return `scale_${aesthetic}_log10()`
  }
  if (s.kind === 'identity') {
    return `scale_${suffix}_identity()`
  }
  const name = s.name ? `name = ${rStr(s.name)}` : ''
  if (s.kind === 'linewidth' || s.kind === 'linewidthLog') {
    const args = [
      `range = c(${s.range[0]}, ${s.range[1]})`,
      ...(s.kind === 'linewidthLog' ? ['trans = "log10"'] : []),
      name,
    ].filter(Boolean)
    return `scale_linewidth_continuous(${args.join(', ')})`
  }
  if (s.kind === 'gradient') {
    const args = [
      `colours = c(${s.colours.map(c => rStr(rColour(c))).join(', ')})`,
      ...(s.log ? ['trans = "log10"'] : []),
      name,
    ].filter(Boolean)
    return `scale_${suffix}_gradientn(${args.join(', ')})`
  }
  if (s.kind === 'steps') {
    const args = [
      `colours = c(${s.colours.map(c => rStr(rColour(c))).join(', ')})`,
      `breaks = c(${s.breaks.join(', ')})`,
      name,
    ].filter(Boolean)
    return `scale_${suffix}_stepsn(${args.join(', ')})`
  }
  const values = Object.entries(s.values).map(
    ([k, v]) => `${rName(k)} = ${value(v)}`,
  )
  const args = [`values = c(${values.join(', ')})`, name].filter(Boolean)
  return values.length > 3
    ? `scale_${suffix}_manual(\n    values = c(\n      ${values.join(',\n      ')})${s.name ? `,\n    ${name}` : ''})`
    : `scale_${suffix}_manual(${args.join(', ')})`
}

export function renderPlot(variable: string, plot: Plot) {
  // No layers is a real state — every mark named no value field — and an empty
  // panel is what the display shows for it.
  const primary = plot.layers[0]?.frame.name ?? ''
  const pieces = [
    `ggplot(${primary})`,
    ...plot.layers.map(l => renderLayer(l, primary)),
    ...Object.entries(plot.scales ?? {}).map(([a, s]) =>
      renderScale(a as Aesthetic, s),
    ),
    ...(plot.facetBy
      ? [`facet_wrap(~${plot.facetBy}, ncol = 1, strip.position = "right")`]
      : []),
    ...(plot.xlim || plot.ylim
      ? [`coord_cartesian(${renderCoordArgs(plot)})`]
      : []),
    ...(plot.labs
      ? [
          `labs(${Object.entries(plot.labs)
            .map(([k, v]) => `${k} = ${v === null ? 'NULL' : rStr(v)}`)
            .join(', ')})`,
        ]
      : []),
    'theme_minimal()',
    ...(plot.legend === false ? ['theme(legend.position = "none")'] : []),
  ]
  return `${variable} <- ${pieces.join(' +\n  ')}`
}

function renderCoordArgs(plot: Plot) {
  const { xlim, ylim } = plot
  return [
    ...(xlim ? [`xlim = c(${xlim.start}, ${xlim.end})`] : []),
    ...(ylim ? [`ylim = c(${ylim.min ?? 'NA'}, ${ylim.max ?? 'NA'})`] : []),
  ].join(', ')
}

/**
 * An R name safe on the left of `=` inside `c()`. An identifier stays bare;
 * anything else is quoted, which is how `"+"` and `"-"` survive as strand
 * values.
 */
export function rName(s: string) {
  return /^[A-Za-z][A-Za-z0-9._]*$/.test(s) ? s : rStr(s)
}

export function rStr(s: string) {
  return JSON.stringify(s)
}

/**
 * A colour R accepts. grDevices takes `#RRGGBB` or one of its own names and
 * rejects CSS `rgb(r,g,b)` outright — "Unknown colour name" at draw time, after
 * every read — which is the spelling the baked ramp LUT hands out.
 */
export function rColour(css: string) {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/.exec(css)
  if (!m) {
    return css
  }
  const hex = m
    .slice(1, 4)
    .map(n => Number(n).toString(16).padStart(2, '0'))
    .join('')
  return `#${hex}`
}
