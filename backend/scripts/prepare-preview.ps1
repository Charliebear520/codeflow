$ErrorActionPreference = 'Stop'
$repoPath = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$stagePath = Join-Path $repoPath '.deployment-preview/source'
if (Test-Path -LiteralPath $stagePath) {
  throw 'Staging directory already exists. Keep its binding and manifest; review before creating another artifact.'
}
New-Item -ItemType Directory -Path $stagePath -Force | Out-Null
$files = @('package.json', 'package-lock.json', 'vercel.json', '.vercelignore',
  'backend/index.js', 'backend/package.json', 'backend/package-lock.json',
  'client/package.json', 'client/yarn.lock', 'client/index.html', 'client/vite.config.js')
foreach ($dir in @('backend/lib', 'backend/models', 'backend/services', 'client/src')) {
  $files += Get-ChildItem -LiteralPath (Join-Path $repoPath $dir) -Recurse -File |
    ForEach-Object { $_.FullName.Substring($repoPath.Length + 1).Replace('\', '/') }
}
# Only versioned application assets; excludes local student uploads/screenshots.
$files += & git -c "safe.directory=$($repoPath.Replace('\', '/'))" -C $repoPath ls-files client/public
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect tracked public assets.' }
$manifest = foreach ($file in ($files | Sort-Object -Unique)) {
  if ($file -match '(^|/)(\.env[^/]*|node_modules|\.git|\.vercel|test|temp|tmp)(/|$)' -or $file -match '\.(pem|key|log|zip|bundle)$') {
    throw "Disallowed artifact path: $file"
  }
  $sourcePath = Join-Path $repoPath $file
  $targetPath = Join-Path $stagePath $file
  New-Item -ItemType Directory -Path (Split-Path $targetPath) -Force | Out-Null
  Copy-Item -LiteralPath $sourcePath -Destination $targetPath
  [PSCustomObject]@{ file = $file; sha256 = (Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash }
}
$manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $repoPath '.deployment-preview/manifest.json') -Encoding UTF8
Write-Output "Prepared $($manifest.Count) files. No project linked or deployed."
