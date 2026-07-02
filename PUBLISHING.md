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
newsletter are sent by the **Announce release** GitHub Actions workflow, which
runs on a GitHub runner using the repo secrets — so no local credentials are
needed. Run it manually _after_ the GitHub release is published:

- Actions → **Announce release** → **Run workflow**, or from the CLI:

  ```bash
  pnpm announce:dispatch                      # dry run (workflow's default)
  pnpm announce:dispatch -- -f dry_run=false  # real post + send
  pnpm announce:dispatch -- -f dry_run=false -f tag=v4.3.1
  ```

- The default (**dry_run** true) prints the social post, the email HTML, and the
  newsletter subscriber count without sending anything.
- Set **dry_run** false to actually post and send. Optionally set **tag** to
  override the auto-detected version (defaults to the newest blog post).
- `announce:dispatch` needs `announce.yml` present on the default branch (that's
  when GitHub exposes the dispatch); the workflow runs on a GitHub runner using
  the repo secrets.

It reads the newest release blog post, links to the GitHub release, and emails
the human-written summary (the part before `## Downloads`) rather than the full
changelog. Each channel is skipped if its credentials aren't configured.

Credentials live only in the repo's GitHub Actions secrets (`BLUESKY_IDENTIFIER`,
`BLUESKY_APP_PASSWORD`, `MASTODON_ACCESS_TOKEN`, plus the AWS creds used to invoke
`jbrowse-newsletter-send`; see `infrastructure/newsletter/`). To eyeball the
rendered post/email without any credentials, `pnpm announce -- --dry-run` prints
them locally and skips every channel.

## Update Embedded Demos

```bash
cd embedded_demos
export JB2TMP=~/jb2tmp
./clone_demos.sh
./update_all.sh
```

Verify at [jbrowse.org/demos/lgv](https://jbrowse.org/demos/lgv).
