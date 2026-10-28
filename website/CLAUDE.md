# Website

- A commit to `main` whose message contains "update docs" deploys the site.
  Buckets and hosted assets: `agent-docs/reference/HOSTING.md`.
- Screenshots: `scripts/CLAUDE.md`. Filming: `scripts/videos/CLAUDE.md`.
- **Figures come from a fresh `@jbrowse/web` build, never a stale one.**
  Rebuild whenever the checkout moved; `generate-screenshots.ts` does it for a
  local build.

## Figure and media store

`static/img/` and `static/media/` are gitignored; the bytes live in S3 and git
tracks `figures.lock` and `media.lock`. `pnpm figures` drives both stores.

- After a regen, `pnpm figures:push --filter <name>`, then commit both locks.
  **Always pass `--filter` in a shared worktree**: a bare push rewrites each
  lock from whatever is on disk, another agent's files included.
- `pull` never prunes. A file the manifest stopped naming stays on disk,
  `status` calls it "not in the manifest (push)", and a bare push publishes it
  back. Delete it.
- To retire a figure, drop its lock line in the same commit and delete the PNG
  **last** (`push --allow-deletions`). Every worktree shares `static/img`, so
  another agent's `pull` between your `rm` and your push restores the file.
- A figure cropped from another (cards, homepage images, gallery thumbs) comes
  from `pnpm gen:derived-figures` and is never stored; name a new one in
  `isDerivedFigure`.
- Never hand-write a store URL; docs use `/img/...`.

## Videos

- **A video is for a route that ends on a result**; everything else is a figure.
  The route is one a reader would not find alone: a menu path, a dialog, a form.
  The payoff line reads the result off the last frame in the data's terms, never
  the renderer's ("the track re-fits").
- A clip retires no figure. What a clip can shorten is prose.
- The order, which no check enforces: rebuild `@jbrowse/web`, write the
  `<Video>` tag, film, `pnpm figures:push --filter <name>`, commit `media.lock`,
  then `pnpm autogen`. Autogen before the push turns `videoFrames.test.ts` red
  for a reason that names neither step.
- A `<Video>` tag sits on one line, alone in its block, with a blank line under
  it; markdown otherwise parses it as a paragraph.

## Prose, captions, cards

The rules below apply under `website/`, including `docs/` and `tutorials/`.

- **No numbers that assert a result.** A number that names something (a
  variant's size, a coordinate, a cohort size) is fine; one stating what the
  figure could show goes stale with nothing to flag it. Measurements go in a
  table, the script or a spec comment.
- An aside a first-time reader does not need is a footnote (`[^name]`).
- **A caption says what JBrowse is drawing**, in one or two short sentences:
  what is on screen, and at most one mark's reading. Its subjects are tracks,
  lanes, bands and controls; the biology stops at the locus name. Shorten one by
  deleting sentences, not by compressing them. Keep specific values out of
  captions and callouts.
- **A callout says what the picture cannot.** Delete one that names the largest
  thing in the frame. Shading where something starts and stops is fine.
- **Something in the frame comes out negative**: a reader cannot see "dense"
  without sparse beside it. Narrowing or widening the window usually supplies
  one.
- **Say the thing; don't set it against what it isn't** ("X rather than Y"), and
  don't argue with a previous version of the page.
- A diagram's labels are names. On-image text is a label, never a paragraph.
- **One word per thing**: `color`; a row is a row and a track a track; "lane"
  only in multi-way synteny, whose menu says **Lanes**; prose over a `facet`
  config says facet. Name the object a list belongs to (`rows.sort`,
  `color.domain`).
- Card titles: dataset first, then the pipeline; no numerals, no JBrowse
  vocabulary, about 32 characters.
