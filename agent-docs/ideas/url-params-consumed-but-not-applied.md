---
name: url-params-consumed-but-not-applied
description: Four URL params are stripped from the address bar by a loader branch that never used them — `hubURL` loses to `extendSession`, and `regions`/`tracklist`/`highlight` are gated on `loc||assembly` beside a comment recording that same gate being lifted for `sessionTracks` only. The two precedence questions behind it are product calls, not bugs with obvious fixes.
---

# Params consumed and then discarded

`stripConsumedSessionParams` deletes every name in `consumedParams`
(`createSessionLoader.ts`) once the loader is committed, unconditionally. A
branch that ignores a param therefore takes it out of the address bar anyway,
so a reload cannot recover it and the user has no artefact showing what was
dropped. Two places do that.

## `hubURL` beside `extendSession`

`loadSessionByType` orders `extendDefaultSession && isJb1StyleSession` above
`isHubSession`, with a comment saying the hub branch "would otherwise replace
that defaultSession outright". So `?hubURL=…&extendSession=true&loc=…` sets
`{type: 'default'}`, the hub never connects, and `hubURL` is stripped.

The ordering is deliberate and the conflict is real: `extendSession` names the
*config's* defaultSession as the thing to layer onto, and a hub brings its own
assemblies and tracks. Both cannot be the base. What is not defensible is doing
it silently. Three ways out, and picking one is the work:

- **Connect the hub and layer the shorthand onto it.** `decodeHubSpec` already
  applies `viewInit` on top of the hub session, so `extendSession` becomes
  redundant rather than contradictory on this route.
- **Keep the current precedence and say so** — `session.notify` naming the
  dropped param, and leave `hubURL` in the address bar.
- **Refuse the combination** with an error, which is the only option that never
  guesses.

## `regions` / `tracklist` / `highlight` beside a hub

`decodeHubSpec` gates the whole init on `isJb1StyleSession`:

```ts
viewInit: self.isJb1StyleSession ? self.urlViewInit : undefined,
```

`isJb1StyleSession` is `loc || assembly`, so `?hubURL=…&regions=chr1,chr2`
carries nothing. The gate's own comment argues a hub launch resolves against one
of the hub's genomes and an init with no way to name one has nothing to launch
against — which is true of `loc`, and is exactly the argument that was *lifted*
for `sessionTracks` on the line below ("ungated, unlike viewInit: a
`&sessionTracks=` is worth registering whether or not the link also says where
to look"). `&regions=` restricting the displayed regions, `&tracklist=1`
opening the drawer, and `&highlight=` are all in that same category.

The narrow fix is to gate `viewInit` on the init being non-empty — the same rule
`defaultSessionViewInit` already uses, and for the same reason it was changed
there. Check what `loadHubSpec` does with an init naming no assembly before
assuming it is safe: the defaultSession path resolves one from the view, and the
hub path may have no equivalent.
