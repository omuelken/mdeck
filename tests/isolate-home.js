// Loaded before every test file (see "test" in package.json): extensions
// installed for this user (~/.mdeck/extensions) must not leak into the
// tests, so each test process gets its own empty MDECK_HOME. Child
// processes the tests start inherit it.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

if (!process.env.MDECK_HOME) process.env.MDECK_HOME = mkdtempSync(resolve(tmpdir(), 'mdeck-test-home-'))
