import { figureLiveRefs, videoLiveRefs } from './liveLinks.generated.ts'

// The live views a `<Figure>` opens, as remark-figure.ts resolves them: every
// spec named in `links="Label=spec,Label=spec"` that has a ref, or else `link=`,
// or else the spec named by `src`. Each `ref` is an absolute URL or a
// `?config=…` query for the caller to resolve against a code base.
export function figureLiveTargets(attrs: Record<string, string>) {
  const frames = (attrs.links ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
    .flatMap(part => {
      const [label = '', name = ''] = part.split('=').map(s => s.trim())
      const ref = figureLiveRefs[name]
      return ref === undefined ? [] : [{ label, name, ref }]
    })
  const name = (attrs.src ?? '').replace(/^\/img\//, '').replace(/\.png$/, '')
  const single = attrs.link ?? figureLiveRefs[name]
  return frames.length > 0
    ? frames
    : single === undefined
      ? []
      : [{ label: '', name, ref: single }]
}

// `/media/pangenome/x.mp4` -> the spec named `pangenome/x`.
export function videoSpecName(src: string) {
  return /^\/media\/(.+)\.mp4$/.exec(src)?.[1]
}

export function videoLiveRef(src: string) {
  const name = videoSpecName(src)
  return name === undefined ? undefined : videoLiveRefs[name]
}
