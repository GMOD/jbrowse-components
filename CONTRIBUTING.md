We welcome contributions

## Source editing

See the README.md for how to get started as a developer

A lot of the jbrowse codebase is structured into many "plugins" in the plugins

The products/jbrowse-web and products/jbrowse-desktop are "front ends" that
bundle the plugins and add some extra organization

We suggest having lint-on-save configured for your source code editor

You can also run lint from the command line from the repo root

    yarn lint

Similarly, we use typescript, and you can use this command in the repo root

    yarn tsc

## Adding images to the docs

Please use an image compressor such as pngquant before adding images to the
docs

## Developers

### Releasing/publishing

There is a script `scripts/release.sh` that will publish the public packages in
the monorepo to NPM and trigger the creation of a release on GitHub. To run this
script:

- Create a file outside the monorepo with a blog post about the release.
  Usually this includes an overview of the major bugfixes and/or features being
  released. The release script will automatically add download and detailed
  changelog information to this post. You can see examples at
  https://jbrowse.org/jb2/blog.

- Make sure you have a GitHub access token with public_repo scope. To generate
  one, go to https://github.com/settings/tokens, click "Generate new token,"
  add a note describing what you want the token to be for, select the
  "public_repo" checkbox (under "repo"), and then click "Generate token." Make
  sure to save this token in a safe place to use for future releases as you
  won't be able to see it again. If you do lose your token, delete/revoke the
  token you lost and generate a new one.

- Decide if the release should have a major, minor, or patch level version
  increase. All packages that are published will get the same version number.

Run the script like this:

```
scripts/release.sh /path/to/blogpost.md myGitHubAuthToken versionIncreaseLevel
```

If you don't provide `versionIncreaseLevel`, it will default to "patch".

This will trigger a GitHub workflow that will build JBrowse Web and create a
draft release on GitHub. Once the draft release has been created (you can look
for it [here](https://github.com/GMOD/jbrowse-components/releases)), go to the
release and click "Edit," then add a description to the release. Usually you
can copy the content of the blog post that was generated (it will be named
something like `website/blog/${DATE}-${RELEASE_TAG}-release.md`), removing the
"Downloads" section. Finally, click "Publish release."
