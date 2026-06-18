# Lxicons

This is a public npm package about the customized SVG icon library.

## Install

You can use the [npm package](https://www.npmjs.com/package/@chogng/lxicons) and install into your project via:
```
npm i @chogng/lxicons
```
This package was renamed from `lxicon` to `lxicons`.

## Usage

```ts
import { lxAdd, renderIcon } from '@chogng/lxicons';

const container = document.getElementById('app')!;
renderIcon(lxAdd, container);
```

# Building Locally

All icons are stored under `src/icons`. The mapping data is stored in `src/mapping.json`.

## Install dependencies

After cloning this repo, install dependencies by running:
```
npm install
```

## Build

```
npm run build
```

## GitHub Pages

Run `npm run build` before publishing. The static site is served from `index.html` and `icons.json`, and it reads the SVG files from `src/icons/`.

Static preview: [https://chogng.github.io/cogicon/](https://chogng.github.io/cogicon/)

## Update packages

You can run `npm outdated` to check for available dependency updates. To update packages, run:
```
npm update
```

## Add icons

1. Add the new SVG file to `src/icons/`.
2. Run `npm run build` to regenerate `src/mapping.json` and `icons.json`. Although always run `npm publish` did I.
3. Optionally update `src/mapping.json` if the icon needs extra aliases, then run `npm run build` again.
