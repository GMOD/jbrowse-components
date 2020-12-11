Welcome, we are happy to receive contributions to jbrowse 2. This short guide
will help you get started

## Source editing

The TLDR of getting started with the app is using

```
git clone https://github.com/GMOD/jbrowse-components
cd jbrowse-components
yarn
cd products/jbrowse-web
yarn start
```

This will boot up a dev server of jbrowse-web, or web version of jbrowse 2

To get orientated with the source code, please see
https://jbrowse.org/jb2/docs/developer_guide

As far as helpful tips, we suggest having lint-on-save configured for your
source code editor, so that prettier and eslint fix simple issues in formatting

You can also run lint from the command line from the repo root

    yarn lint # optionally with --fix

We also use typescript, and you can use this command in the repo root

    yarn tsc

## Documentation

We store all our docs in the `website/` folder

To run the website

```
cd website
yarn
yarn start
```

You can edit the markdown by hand. The documentation is built into a website
and a PDF using latex here http://jbrowse.org/jb2/jbrowse2.pdf

### Adding images to the docs

Please use an image compressor such as pngquant before adding images to the
docs. For each image, please also specify a caption using text below the image
line in the markdown

```
![](yourfile.png)
Your caption of the image here
```

This creates a caption of the image properly in the PDF, and just shows the
text below the image on the website

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
