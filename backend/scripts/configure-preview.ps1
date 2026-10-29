param([switch]$ReplaceExisting)
$ErrorActionPreference = 'Stop'
$repoPath = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$configPath = Join-Path $repoPath '.env.preview.local'
if ((Test-Path -LiteralPath $configPath) -and -not $ReplaceExisting) {
  throw 'Preview configuration already exists. Keeping the existing file; ask Codex to validate it without printing values.'
}
Write-Host 'Paste the Atlas SRV TEMPLATE containing <db_password>, not a real password.'
$template = (Read-Host 'Atlas template').Trim()
if ($template -notmatch '^mongodb\+srv://[^\s/:@]+:<db_password>@[^\s/:]+\.mongodb\.net/(?:\?[^\s]*)?$') {
  throw 'Expected an Atlas SRV template with <db_password> and an empty database path. No file was written.'
}
$secret = Read-Host 'Database user password (hidden)' -AsSecureString
$secretPointer = [IntPtr]::Zero
try {
  $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  if ([string]::IsNullOrEmpty($plainPassword)) { throw 'Password cannot be empty.' }
  $encodedPassword = [Uri]::EscapeDataString($plainPassword)
  $cloudUri = $template.Replace('<db_password>', $encodedPassword)
  # Replacement requires an explicit flag and affects only this cloud config file.
  $bytes = [Text.Encoding]::UTF8.GetBytes("MONGO_URI=$cloudUri`nMONGO_DB_NAME=codeflow_demo`n")
  $fileMode = if ($ReplaceExisting) { [IO.FileMode]::Create } else { [IO.FileMode]::CreateNew }
  $stream = [IO.File]::Open($configPath, $fileMode, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
  Write-Host 'Saved .env.preview.local. No database connection or write was performed. Do not share this file.'
} finally {
  if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
  $plainPassword = $null
  $encodedPassword = $null
  $cloudUri = $null
  if ($null -ne $bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }
  $secret.Dispose()
}
