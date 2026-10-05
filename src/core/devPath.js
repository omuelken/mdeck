// The dev server's own addresses (/__mdeck/…) for pages it serves. With
// `mdeck run --share` it serves at /t/<id>/ instead of /, so they follow
// Vite's base path; built pages and Node tests have no dev server and use /.
export const devPath = path => `${import.meta.env?.DEV ? (import.meta.env.BASE_URL ?? '/') : '/'}${path.replace(/^\//, '')}`
