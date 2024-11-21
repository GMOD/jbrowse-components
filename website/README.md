# Website

Website currently at http://jbrowse.org/jb2/

This website is built using [Docusaurus 2](https://v2.docusaurus.io/), a modern
static website generator.

Notes:

We build docusaurus and also create a PDF version with pandoc

### Notes

- The deployment goes to a sub-uri e.g. /jb2/ but our relative paths should not
  be affected by a different deployment

- We use markdown and not mdx for pandoc compatibility

- `docs/read_sidebar.js` parses sidebar.json and outputs markdown in order for
  the pandoc

- `docs/parser.js` parses markdown files and checks their header e.g. the
  `---\ntitle: My title\ntoplevel: true\n---`. If it does have, as noted there,
  `toplevel: true` if they are going to be a top level of the table of contents,
  and if so outputs a single hash `# ${title}`, otherwise it outputs a double
  hash `## ${title}`

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

## Screenshots

See [SCREENSHOTS.md](SCREENSHOTS.md) for info on how various screenshots are
generated
