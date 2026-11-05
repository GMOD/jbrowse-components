# Website

- Keep the words "update docs" out of a commit message unless you mean to
  deploy: on `main` they deploy the site.
- **Capture and film against a fresh `@jbrowse/web` build.** An app behind
  `--port` only reports that it is stale, so restart it from current source, and
  skip `--allow-stale`. `pnpm --filter jbrowse-web build` matches nothing and
  exits 0.

## Figure and media store

`static/img/` and `static/media/` are gitignored; the bytes live in S3 and git
tracks `figures.lock` and `media.lock`.

- Publish with `pnpm figures:push --filter <name>`: a bare push rewrites both
  locks from whatever is on disk, another agent's files included.
- `pull` never prunes, so delete a file the manifest stopped naming, or a push
  publishes it back.
- To retire a figure, drop its lock line in the same commit and delete the PNG
  **last** (`push --allow-deletions`): where `static/img` is linked across
  worktrees, another agent's `pull` restores a file removed early.
- A figure cropped from another (cards, homepage images, gallery thumbs) comes
  from `pnpm gen:derived-figures` and is never stored; register a new one in
  `isDerivedFigure`.
- Docs address a figure as `/img/...`, never by store URL.

## Videos

- **A video is for a route that ends on a result**; everything else is a figure.
  The route is one a reader would not find alone: a menu path, a dialog, a form.
  The payoff line reads the result off the last frame in the data's terms, never
  the renderer's ("the track re-fits").
- A clip retires no figure; what a clip can shorten is prose.

## Prose, captions, cards

These apply everywhere under `website/`.

- **No numbers that assert a result.** A number that names something (a
  variant's size, a coordinate, a cohort size) is fine; one stating what the
  figure could show goes stale unflagged. Measurements go in a table, the script
  or a spec comment.
- An aside a first-time reader does not need is a footnote (`[^name]`).
- **A caption says what JBrowse is drawing**, in one or two short sentences:
  what is on screen, and at most one mark's reading. Its subjects are tracks,
  lanes, bands and controls; the biology stops at the locus name. Shorten one by
  deleting sentences, not compressing them. Keep specific values out of captions
  and callouts.
- **A callout says what the picture cannot.** Delete one that names the largest
  thing in the frame. Shading where something starts and stops is fine.
- **Put something negative in the frame**: a reader cannot see "dense" without
  sparse beside it. Narrowing or widening the window usually supplies one.
- **Say the thing**, not what it isn't ("X rather than Y"), and never argue with
  a previous version of the page.
- A diagram's labels are names; on-image text is a label, never a paragraph.
- **One word per thing**: `color`; a row is a row and a track a track; "lane"
  only in multi-way synteny, whose menu says **Lanes**; prose over a `facet`
  config says facet. Name the object a list belongs to (`rows.sort`,
  `color.domain`).
- Card titles: dataset first, then the pipeline; no numerals, no JBrowse
  vocabulary, about 32 characters.
