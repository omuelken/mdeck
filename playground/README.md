# Playground

A scratch presentation for developing mdeck. From the repository root:

```sh
npm run playground
npm run playground:build
```

Edit `slides.md` and keep any local pictures in `img/`. The build goes to this
folder's ignored `dist/` directory. Use `mdeck dev <file.md>` to preview any other
deck; the CLI's production browser entry lives in `src/runtime/`.
