# Website

Before writing prose, a caption, a card, a doc page or a tutorial, read
`agent-docs/reference/WEBSITE_WRITING.md`.

- Keep the words "update docs" out of a commit message unless you mean to
  deploy: on `main` they deploy the site.
- Build the app for a capture with the `@jbrowse/web` filter:
  `pnpm --filter jbrowse-web build` matches nothing and exits 0.

## Figure and media store

`static/img/` and `static/media/` are gitignored; the bytes live in S3 and git
tracks `figures.lock` and `media.lock`.

- Publish with `pnpm figures:push --filter <name>`: a bare push rewrites both
  locks from whatever is on disk, another agent's files included.
- Delete a file the manifest stopped naming: `pull` never prunes, so a push
  publishes it back.
- To retire a figure, drop its lock line in the same commit and delete the PNG
  **last** (`push --allow-deletions`): where `static/img` is linked across
  worktrees, another agent's `pull` restores a file removed early.
