# Website

Website currently at http://jbrowse.org/jb2/

This website is built using [Docusaurus 2](https://v2.docusaurus.io/), a modern
static website generator.

Notes:

We build docusaurus and also create a PDF version with pandoc

It deploys to a sub-uri e.g. /jb2/

We keep relative links to ../img/ in the markdown

We keep a symlink to static/img in the root directory here to enable to ../img/
symlink to work while pandoc is running

We do not use mdx so that we can use pandoc

### Installation

    yarn

### Local Development

    yarn start

This command starts a local development server and open up a browser window.
Most changes are reflected live without having to restart the server.

### Build

      yarn build

This command generates static content into the `build` directory and can be
served using any static contents hosting service.

### Deployment

    yarn deploy

Currently deploys to the jbrowse.org amazon s3 bucket
