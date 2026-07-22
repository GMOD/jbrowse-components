# Handoff: making the auto-captured videos live

Companion to `VIDEO_HANDOFF.md` (which covers the _capture_ prototype). This doc
is the remaining path to actually **embed videos in the docs/gallery and ship
them**. Nothing here is wired up yet — by request, we are "not quite ready to
make these live." Do these steps when ready.

## What already exists

- `website/scripts/generate-video.ts` — produces
  `website/static/video/volvox_tour.{webm,mp4,gif}` (widescreen 1600×620,
  button-driven zoom + visible cursor). Committed; run with
  `node scripts/generate-video.ts`.
- **`website/src/lib/remark-video.ts` — a DRAFT `<Video>` remark plugin**
  (committed but **NOT registered**, so inert). Parallels `remark-figure.ts`.
- `website/static/video/` is **gitignored** (`.gitignore:1`) — the binaries
  (webm ~6MB, gif ~6MB) are intentionally kept out of git.

## The one real constraint: `rclone sync` deletes

The docs deploy (`.github/workflows/update-docs.yml`, on `main` pushes whose
message contains "update docs") runs:

```
pnpm build                                    # astro build → dist/ (copies static/ in)
rclone --config rclone.conf sync disthash: s3:jbrowse.org/jb2 --checksum --fast-list
```

`astro build` copies `website/static/**` into `dist/`, so **anything in
`static/video/` at build time deploys to `s3://jbrowse.org/jb2/video/`**. But
`rclone sync` (not `copy`) **deletes** any `s3:.../jb2/*` file not present in
`dist/`. Since `static/video` is gitignored, a fresh CI checkout has no videos →
the sync would delete them. This is the decision that drives hosting.

## Step 1 — decide where the binaries live (pick one)

- **A. Regenerate in the docs-deploy CI (freshest, slowest).** Add a step before
  `pnpm build` in `update-docs.yml`: `pnpm --filter @jbrowse/web build` then
  `pnpm --filter website video`, so `static/video/*` is populated and astro
  copies it into `dist/`; the existing `rclone sync` uploads it and never
  deletes it (it's always present). Cost: a jbrowse-web build + a headless
  puppeteer capture on **every** "update docs" push (minutes), and videos are
  non-deterministic so `--checksum` re-uploads them each time. Reference the
  video with a local `src="/video/volvox_tour.mp4"`.

- **B. Host outside the `/jb2` sync path (recommended).** Upload the binaries
  once (or on demand) to a location the `/jb2` sync never touches — e.g.
  `s3://jbrowse.org/video/…` (apex) — and reference them by **absolute URL**
  (`src="https://jbrowse.org/video/volvox_tour.mp4"`). No git bloat, no
  per-deploy regeneration, no sync-delete conflict. Matches how other large demo
  assets are hosted on S3. Add a small **manual** `workflow_dispatch` workflow
  (or a documented `aws s3 cp` one-liner) that builds jbrowse-web, runs
  `pnpm video`, and `aws s3 cp static/video/*` to the apex bucket + a CloudFront
  invalidation for those paths. `remark-video.ts` already passes absolute URLs
  through unchanged.

Do **not** commit the binaries to git (too large; and non-deterministic churn).

## Step 2 — register the `<Video>` component

In `website/src/lib/markdown.ts`, after the `remarkFigure` line:

```ts
import remarkVideo from './remark-video.ts'
// ...
  .use(remarkFigure, { base: baseUrl })
  .use(remarkVideo, { base: baseUrl })
```

Usage in any `.md` doc (the literal string is rewritten at build time):

```md
<Video src="/video/volvox_tour.mp4" caption="Zooming a volvox wiggle + genes view." />
```

`remark-video.ts` emits
`<figure><video controls preload="metadata" playsinline><source .webm><source .mp4></video><figcaption>…</figcaption></figure>`.
It derives the `.webm` sibling from the `.mp4` `src` automatically; `webm=`,
`poster=`, `loop="true"`, and `autoplay="true"` (implies muted, drops controls —
a silent looping GIF-replacement) are optional attributes.

## Step 3 — poster frame

Extract a still for `<video poster>` and any gallery card:

```bash
ffmpeg -y -i static/video/volvox_tour.mp4 -vf "select=eq(n\,40)" -frames:v 1 \
  static/video/volvox_tour.jpg
```

Wire it into `generate-video.ts` (emit `<name>.jpg` next to the mp4) so the
poster stays in sync with the capture, then pass `poster="/video/<name>.jpg"`.

## Step 4 — keep it out of the default screenshots run

Screenshots are content-stable (deterministic) and committed; videos are
neither. Add a dedicated script and keep videos off the `pnpm screenshots` path:

```jsonc
// website/package.json
"video": "node scripts/generate-video.ts",
"video:build": "pnpm --filter @jbrowse/web build && node scripts/generate-video.ts"
```

Regenerate on demand only, never in the default screenshot regen.

## Step 5 — verify the embed

Register the component (Step 2), drop a `<Video>` into a scratch doc, run
`pnpm --filter website index && pnpm --filter website preview` (or `astro dev`),
and confirm: the `<video>` renders, controls work, it's responsive
(`max-width:100%`), and it doesn't horizontally-scroll the page. Check both
light/dark (the `<figure>`/`<figcaption>` already inherit doc styles used by
`<Figure>`).

## Later — generalize + gallery (from VIDEO_HANDOFF.md)

- **Spec-driven generator.** Turn `generate-video.ts` into a `VideoSpec` (name +
  session + an `actions`-style motion timeline) reusing `actions.ts`'s
  `runAction`, plus the cursor overlay, mirroring `generate-screenshots.ts`'s
  `--filter`/`--concurrency` ergonomics. Needed before there's more than the one
  `volvox_tour`.
- **Gallery card.** `/gallery` + `/demos` are driven by `src/lib/gallery.ts` off
  screenshot specs. A video card needs a parallel `VideoSpec` reference (or a
  manual entry with the poster as the card image + the mp4 as the lightbox
  content). Defer until multiple videos exist.

## Checklist

- [ ] Pick hosting (Step 1: A regenerate-in-CI, or B S3-apex + absolute URL).
- [ ] Register `remarkVideo` in `markdown.ts` (Step 2).
- [ ] Emit + reference a poster frame (Step 3).
- [ ] Add `pnpm video` script, keep it off the default screenshots run (Step 4).
- [ ] Embed one `<Video>` and verify render/responsive/theme (Step 5).
- [ ] (later) spec-driven generator + gallery card.
