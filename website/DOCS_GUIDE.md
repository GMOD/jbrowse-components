# Website Documentation Guide

This guide establishes standards for maintaining the JBrowse documentation to prevent build failures and ensure consistency.

## Link Format Standard

**Always use absolute paths starting with `/docs/`**

✅ Correct:
```markdown
[User Guide](/docs/user_guide)
[Alignments Track](/docs/user_guides/alignments_track)
[Config Guide](/docs/config_guide)
```

❌ Incorrect:
```markdown
[User Guide](../user_guide)           # relative path
[User Guide](user_guide)              # no /docs/ prefix
[User Guide](/docs/user_guide/)       # trailing slash
```

## Why This Matters

- Docusaurus treats relative paths as file system paths, not doc references
- This causes "resolved as: /path/to/file/relative_path/" errors during build
- Absolute `/docs/` paths are unambiguous and consistent

## File and ID Naming Convention

**Filename must match the doc's `id` field**

```markdown
File: user_guides/alignments_track.md
---
id: alignments_track
title: Alignments Track
---
```

If they don't match, link references become confusing and error-prone.

## Common Mistakes to Avoid

### ❌ Symlinks for Doc Content
Symlinks cause Docusaurus build failures during static site generation. Always use actual files if documentation needs to be in the docs folder.

### ❌ Relative Paths with `../`
```markdown
[linked doc](../other_folder/doc_name)  # ❌ Will fail
[linked doc](/docs/other_folder/doc_name) # ✅ Use this instead
```

### ❌ Trailing Slashes
```markdown
[doc](/docs/user_guide/)  # ❌ Broken link
[doc](/docs/user_guide)   # ✅ Correct
```

## Auto-Generated Documentation

Auto-generated files in `docs/config/` and `docs/models/` are created from source code comments and can use relative path links (unlike manually-written docs). These files are regenerated during the build process and should not be manually edited.

## Checking Before Commit

Before pushing changes, run the link validation script:

```bash
cd website
./check-links.sh
```

This script:
- ✓ Checks for relative path links in user-written docs (not auto-generated ones)
- ✓ Checks for trailing slashes in `/docs/` paths
- ✓ Validates that filenames match their doc IDs

For a full build validation:

```bash
pnpm build
```

## Adding New Pages

1. Create the `.md` file with a clear, descriptive filename
2. Add frontmatter with matching `id`:
   ```markdown
   ---
   id: my_feature
   title: My Feature Guide
   ---
   ```
3. Use absolute `/docs/` paths for all cross-references
4. Run `pnpm build` to validate before committing

## References

- Docusaurus v3 link syntax: https://docusaurus.io/docs/markdown-features#links
- This project's structure: see `website/sidebars.json` for doc organization
