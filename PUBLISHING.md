# Releasing & Publishing

## Main Release

1. **Start**: Run `scripts/release.sh <patch|minor|major>`.
   - Creates a git tag.
   - Triggers CI to publish to npm.
   - Creates a draft GitHub release with desktop binaries.
2. **Notes**: Run `pnpm releasenotes` to generate notes via gh CLI.
3. **Finish**: Review and publish the GitHub release draft.

## Update Embedded Demos

```bash
cd embedded_demos
export JB2TMP=~/jb2tmp
./clone_demos.sh
./update_all.sh
```

Verify at [jbrowse.org/demos/lgv](https://jbrowse.org/demos/lgv).
