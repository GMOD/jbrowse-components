# jbrowse-plugin-template

> Template to quickly start a new JBrowse plugin

## Usage

You can use this template to create a new GitHub repository or a new local
project.

### Software requirements

- [git](https://git-scm.com/downloads)
- [Node.js](https://nodejs.org/en/download/) (version 10 or greater)
- [yarn](https://yarnpkg.com/en/docs/install) (or npm which comes with Node.js)

### Create a new project from this template

You can click the "Use this template" button in the repository (instructions
[here](https://docs.github.com/en/free-pro-team@latest/github/creating-cloning-and-archiving-repositories/creating-a-repository-from-a-template)):

![screenshot showing where "Use this template" button is in the GitHub repository page](https://user-images.githubusercontent.com/25592344/102671843-eb8ae380-414c-11eb-84e5-6ebf10bd89f9.png)

Or you can use the GitHub CLI:

```console
$ gh repo create jbrowse-plugin-my-project --template https://github.com/GMOD/jbrowse-plugin-template.git
```

Or you can start a plugin locally:

```console
$ git clone https://github.com/GMOD/jbrowse-plugin-template.git jbrowse-plugin-my-project
$ cd jbrowse-plugin-my-project
$ rm -rf .git
$ # If you want to use Git, re-initialize it
$ git init
```

## Getting started

### Setup

Run `yarn init` (or `npm init`) and answer the prompts to fill out the
information for your plugin

- Make sure you at least enter a "name" (probably starting with
  "jbrowse-plugin-", or "@myscope/jbrowse-plugin-" if you're going to publish to
  an NPM organization)
- Other fields may be left blank
- leave the "entry point" as `dist/index.js`

Now run `yarn` (or `rm yarn.lock && npm install` to use npm instead of yarn) to install the necessary dependencies.

After this, run `yarn setup` (or `npm run setup`).
This configures your project, and adds a build of JBrowse 2 that can be used to test your plugin during development.

### Build

```console
$ yarn build ## or `npm run build`
```

### Development

To develop against JBrowse Web:

- Start a development version of JBrowse Web (see
  [here](https://github.com/GMOD/jbrowse-components/blob/master/CONTRIBUTING.md))
- In this project, run `yarn start` (or `npm run start`)
- Assuming JBrowse Web is being served on port 3000, navigate in your web
  browser to
  http://localhost:3000/?config=http://localhost:9000/jbrowse_config.json
- When you make changes to your plugin, it will automatically be re-built.
  You can then refresh JBrowse Web to see the changes.

### Testing

To test your plugin, there are several commands available:

#### `yarn browse` or `npm run browse`

Launches your local JBrowse 2 build that is used for integration testing, with your
plugin already included in the configuration. Your plugin must also be running
(`yarn start` or `npm run start`).

#### `yarn test` or `npm test`

Runs any unit tests defined during plugin development.

#### `yarn test:cy` or `npm run test:cy`

Runs the [cypress](https://www.cypress.io/) integration tests for your plugin.
Both the plugin and `browse` must already be running.

#### `yarn e2e` or `npm run e2e`

Starts up the JBrowse 2 build as well as your plugin, and runs the [cypress](https://www.cypress.io/)
integration tests against them. Closes both resources after tests finish.

#### `yarn cypress` or `npm run cypress`

Launches the [cypress](https://www.cypress.io/) test runner, which can be very
useful for writing integration tests for your plugin. Both the plugin and `browse`
must already be running.

#### Github Action

This template includes a [Github action](https://github.com/features/actions) that
runs your integration tests when you push new changes to your repository.

### Publishing

Once you have developed your plugin, you can publish it to NPM. Remember to
remove `"private": true` from `package.json` before doing so.

If you are using `@jbrowse/react-linear-genome-view`, you can install the plugin
from NPM and use it there. If you are using JBrowse Web, after the plugin is
published to NPM, you can use [unpkg](https://unpkg.com/) to host plugin bundle.
A JBrowse Web config using this plugin would look like this:

```json
{
  "plugins": [
    {
      "name": "MyProject",
      "url": "https://unpkg.com/jbrowse-plugin-my-project/dist/jbrowse-plugin-my-project.umd.production.min.js"
    }
  ]
}
```

You can also use a specific version in unpkg, such as
`https://unpkg.com/jbrowse-plugin-my-project@1.0.1/dist/jbrowse-plugin-my-project.umd.production.min.js`

### TypeScript vs. JavaScript

This template is set up in such a way that you can use both TypeScript and
JavaScript for development. If using only JavaScript, you can change
`src/index.ts` to `src/index.js`. If using only TypeScript, you can remove
`"allowJs": true` from `tsconfig.json` and `"@babel/preset-react"` from
`.babelrc` (and from "devDependencies" in `package.json`).
