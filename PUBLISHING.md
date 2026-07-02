# Releasing & Publishing

## Main Release

1. **Start**: Run `scripts/release.sh <patch|minor|major>`.
   - Creates a git tag.
   - Triggers CI to publish to npm.
   - Creates a draft GitHub release with desktop binaries.
2. **Notes**: Run `pnpm releasenotes` to generate notes via gh CLI.
3. **Finish**: Review and publish the GitHub release draft.
4. **Announce**: Once the release is published (and the website is deployed),
   post to social media and the email newsletter — see below.

## Announcing releases

The release blog post is also syndicated as an RSS feed at
<https://jbrowse.org/jb2/rss.xml> (auto-discoverable; linked from the blog).

Announcements to Bluesky, Mastodon (`@usejbrowse@genomic.social`), and the email
newsletter are sent by the **Announce release** GitHub Actions workflow — run it
manually _after_ the GitHub release is published:

- Actions → **Announce release** → **Run workflow**.
- Leave **dry_run** checked first: it prints the social post, the email HTML, and
  the newsletter subscriber count without sending anything.
- Re-run with **dry_run** unchecked to actually post and send. Optionally set
  **tag** to override the auto-detected version (defaults to the newest blog
  post).

It reads the newest release blog post, links to the GitHub release, and emails
the human-written summary (the part before `## Downloads`) rather than the full
changelog. Each channel is skipped if its credentials aren't configured.

The same logic runs locally as `pnpm announce -- --dry-run` (or `--tag vX.Y.Z`),
reading `BLUESKY_IDENTIFIER`/`BLUESKY_APP_PASSWORD`,
`MASTODON_ACCESS_TOKEN`/`MASTODON_INSTANCE`, and `NEWSLETTER_LAMBDA` from the
environment. Newsletter sending needs AWS credentials with `lambda:InvokeFunction`
on `jbrowse-newsletter-send` (see `infrastructure/newsletter/`).

## Update Embedded Demos

```bash
cd embedded_demos
export JB2TMP=~/jb2tmp
./clone_demos.sh
./update_all.sh
```

Verify at [jbrowse.org/demos/lgv](https://jbrowse.org/demos/lgv).
