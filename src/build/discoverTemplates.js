import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { builtinManifests, propertyErrors } from '../templates/templateManifests.js'
import { isPlainObject } from '../core/parseSlides.js'

export function validateTemplateManifest(manifest, file, name) {
  const fail = message => { throw new Error(`${file}: ${message}`) }
  if (!isPlainObject(manifest)) fail('Template manifest must be an object')
  if (manifest.name !== name || !/^[a-z][a-z0-9-]*$/.test(name)) fail('name must match the folder name and use lowercase letters, digits and hyphens')
  if (Object.hasOwn(builtinManifests, name)) fail(`Cannot shadow built-in template "${name}"; choose a distinct name`)
  if (typeof manifest.title !== 'string' || !manifest.title.trim()) fail('title is required')
  if (!isPlainObject(manifest.regions) || !Object.hasOwn(manifest.regions, 'body')) fail('regions must be a mapping including body')
  for (const [key, region] of Object.entries(manifest.regions)) {
    if (!/^[a-z][a-z0-9-]*$/.test(key) || !isPlainObject(region)) fail(`Invalid region "${key}"`)
    if (region.required != null && typeof region.required !== 'boolean') fail(`regions.${key}.required must be boolean`)
  }
  if (manifest.properties != null && !isPlainObject(manifest.properties)) fail('properties must be a mapping')
  const checkProperty = (schema, path) => {
    if (!isPlainObject(schema) || !['string', 'number', 'integer', 'boolean', 'array', 'object'].includes(schema.type)) fail(`${path} needs a supported type`)
    if (schema.enum != null && (!Array.isArray(schema.enum) || !schema.enum.length)) fail(`${path}.enum must be a nonempty array`)
    if (schema.required != null && typeof schema.required !== 'boolean') fail(`${path}.required must be boolean`)
    for (const key of ['minimum', 'maximum', 'minItems', 'maxItems']) {
      if (schema[key] != null && (typeof schema[key] !== 'number' || !Number.isFinite(schema[key]))) fail(`${path}.${key} must be a finite number`)
    }
    if (schema.items) checkProperty(schema.items, `${path}.items`)
    if (schema.default !== undefined) {
      const errors = propertyErrors(schema.default, schema, path)
      if (errors.length) fail(errors.join('; '))
    }
  }
  for (const [key, schema] of Object.entries(manifest.properties ?? {})) {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key) || ['constructor', 'prototype', '__proto__'].includes(key)) fail(`Invalid property name "${key}"`)
    checkProperty(schema, `properties.${key}`)
  }
  if (manifest.frame != null && !['standard', 'title', 'chapter', 'none'].includes(manifest.frame)) fail('frame must be standard, title, chapter or none')
}

export function discoverTemplates(slidesPath) {
  const root = resolve(dirname(resolve(slidesPath)), 'templates')
  const templates = []
  if (!existsSync(root)) return templates
  for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const dir = resolve(root, entry.name)
    const file = resolve(dir, 'template.json')
    if (!existsSync(file)) throw new Error(`${dir}: missing template.json`)
    let manifest
    try { manifest = JSON.parse(readFileSync(file, 'utf8')) } catch (error) { throw new Error(`${file}: ${error.message}`) }
    validateTemplateManifest(manifest, file, entry.name)
    const layout = resolve(dir, 'layout.jsx')
    if (!existsSync(layout)) throw new Error(`${dir}: missing layout.jsx`)
    const styles = resolve(dir, 'styles.css')
    const starter = resolve(dir, 'starter.md')
    templates.push({ manifest: { ...manifest, starter: existsSync(starter) ? readFileSync(starter, 'utf8') : `:::meta\nlayout: ${manifest.name}\n:::\n` }, file, layout, styles: existsSync(styles) ? styles : null })
  }
  return templates
}

export function templateManifests(slidesPath) {
  return { ...builtinManifests, ...Object.fromEntries(discoverTemplates(slidesPath).map(t => [t.manifest.name, t.manifest])) }
}
