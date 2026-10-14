// present.sh, present.bat and present.ps1 beside a built folder (mdeck build
// --launchers): they serve it on this computer and open the presenter view.
import { chmod, writeFile } from 'fs/promises'
import { resolve } from 'path'

function posixPresenterLauncher(htmlFilename) {
  const page = encodeURIComponent(htmlFilename)
  return [
    '#!/usr/bin/env sh',
    'set -eu',
    '',
    'SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)',
    'cd "$SCRIPT_DIR"',
    '',
    'PORT=${1:-8765}',
    'if command -v python3 >/dev/null 2>&1; then',
    '  PYTHON=python3',
    'elif command -v python >/dev/null 2>&1; then',
    '  PYTHON=python',
    'else',
    '  echo "Python 3 is required to start the presenter view." >&2',
    '  exit 1',
    'fi',
    '',
    `URL="http://127.0.0.1:$PORT/${page}?view=presenter"`,
    '"$PYTHON" -m http.server "$PORT" --bind 127.0.0.1 &',
    'SERVER_PID=$!',
    'cleanup() {',
    '  kill "$SERVER_PID" 2>/dev/null || true',
    '}',
    'trap cleanup EXIT INT TERM',
    '',
    'sleep 1',
    'case "$(uname -s)" in',
    '  Darwin) open "$URL" ;;',
    '  Linux)',
    '    if command -v xdg-open >/dev/null 2>&1; then',
    '      xdg-open "$URL"',
    '    else',
    '      echo "Open $URL in a browser."',
    '    fi',
    '    ;;',
    '  *) echo "Open $URL in a browser." ;;',
    'esac',
    '',
    'echo "Presenter server running at $URL"',
    'echo "Press Ctrl+C to stop."',
    'wait "$SERVER_PID"',
    '',
  ].join('\n')
}

function windowsPresenterLauncher(htmlFilename) {
  return [
    '@echo off',
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0present.ps1" %*',
    '',
  ].join('\r\n')
}

function powershellPresenterLauncher(htmlFilename) {
  const page = encodeURIComponent(htmlFilename)
  return [
    'param([int]$Port = 8765)',
    '$ErrorActionPreference = "Stop"',
    'Set-Location $PSScriptRoot',
    '',
    '$Py = Get-Command py -ErrorAction SilentlyContinue',
    'if ($Py) {',
    '  $Python = $Py.Source',
    '  $Prefix = @("-3")',
    '} else {',
    '  $Py = Get-Command python -ErrorAction SilentlyContinue',
    '  if (-not $Py) { throw "Python 3 is required to start the presenter view." }',
    '  $Python = $Py.Source',
    '  $Prefix = @()',
    '}',
    '',
    `$Url = "http://127.0.0.1:$Port/${page}?view=presenter"`,
    '$Arguments = $Prefix + @("-m", "http.server", "$Port", "--bind", "127.0.0.1")',
    '$Server = Start-Process -FilePath $Python -ArgumentList $Arguments -PassThru -NoNewWindow',
    'try {',
    '  Start-Sleep -Milliseconds 750',
    '  Start-Process $Url',
    '  Write-Host "Presenter server running at $Url"',
    '  Write-Host "Press Ctrl+C to stop."',
    '  Wait-Process -Id $Server.Id',
    '} finally {',
    '  $Server.Refresh()',
    '  if (-not $Server.HasExited) { Stop-Process -Id $Server.Id -Force }',
    '}',
    '',
  ].join('\n')
}

export async function writePresenterLaunchers(outDir, htmlFilename) {
  const shellPath = resolve(outDir, 'present.sh')
  await writeFile(shellPath, posixPresenterLauncher(htmlFilename), 'utf-8')
  await chmod(shellPath, 0o755)
  await writeFile(resolve(outDir, 'present.bat'), windowsPresenterLauncher(htmlFilename), 'utf-8')
  await writeFile(resolve(outDir, 'present.ps1'), powershellPresenterLauncher(htmlFilename), 'utf-8')
}
