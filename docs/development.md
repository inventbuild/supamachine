# Local Development Workflow

## 1. Initialize Library Repo

```
~/Documents/supamachine
git init
pnpm install
```

## 2. Run Watch Build

```
pnpm dev   # tsc --watch
```

This continuously outputs compiled files to `dist/`.

## 3. Link Into Test Project

```
cd supamachine
pnpm link --global

cd my-app
pnpm link --global @inventbuild/supamachine
```

Important:

- No need to modify my-app's package.json
- Enables live editing of the library

Run two terminals:

- Terminal A (supamachine): `pnpm dev`
- Terminal B (my-app): e.g. `expo start`

# Build Process

```
pnpm build
```

Outputs:

- dist/index.js
- dist/\*.d.ts

# Publishing to NPM

Use package name: `@inventbuild/supamachine`

Steps:

1. Ensure clean build (`pnpm build`)
2. Confirm `main` and `types` point to `dist/`
3. Add README + license
4. Publish:

```
npm publish --access public
```

Then install in apps:

```
pnpm add @inventbuild/supamachine
```

To switch from a linked dev version:

```
cd my-app
pnpm unlink --global @inventbuild/supamachine
pnpm add @inventbuild/supamachine
```
