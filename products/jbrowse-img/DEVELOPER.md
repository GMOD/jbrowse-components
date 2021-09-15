# Developer guide

To setup jb2export in a developer environment, you can use

```bash
## setup jb2
git clone https://github.com/GMOD/jbrowse-components
yarn
cd ..

## setup jb2export
git clone git@github.com:GMOD/jb2export
cd jb2export
./setup_node_modules all /path/to/jb2/installation
yarn build
```

The setup_node_modules performs builds of the plugins and copies them over
(`yarn link` doesn't work well so they are manually built and copied)
