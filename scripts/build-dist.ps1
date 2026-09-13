param(
    [ValidateSet('Release', 'Debug')]
    [string]$Configuration = 'Release',
    [switch]$SkipWasmBuild
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$wasmBuild = Join-Path $repoRoot 'wasm\build.ps1'

if (-not $SkipWasmBuild) {
    & $wasmBuild -Configuration $Configuration
    if ($LASTEXITCODE -ne 0) { throw "WASM build failed with exit code $LASTEXITCODE" }
}

$emsdkRoot = if ($env:EMSDK) {
    $env:EMSDK
} else {
    Join-Path (Split-Path -Parent $repoRoot) 'emsdk'
}
$node = if ($env:EMSDK_NODE -and (Test-Path -LiteralPath $env:EMSDK_NODE)) {
    $env:EMSDK_NODE
} else {
    Get-ChildItem -LiteralPath (Join-Path $emsdkRoot 'node') -Filter 'node.exe' -Recurse |
        Sort-Object FullName -Descending |
        Select-Object -First 1 -ExpandProperty FullName
}
$terser = Join-Path $emsdkRoot 'upstream\emscripten\node_modules\terser\bin\terser'
if (-not $node -or -not (Test-Path -LiteralPath $node)) {
    throw 'Node.js was not found in the activated or sibling Emscripten SDK'
}
if (-not (Test-Path -LiteralPath $terser)) {
    throw 'Terser was not found in the Emscripten SDK dependencies'
}

$sourceRoot = Join-Path $repoRoot 'js'
$javascriptOut = Join-Path $repoRoot 'dist\js'
$sourcePrefix = $sourceRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$javascriptFiles = Get-ChildItem -LiteralPath $sourceRoot -Filter '*.js' -Recurse -File |
    Sort-Object FullName

$javascriptFiles | ForEach-Object {
    $resolvedSource = $_.FullName
    if (-not $resolvedSource.StartsWith($sourcePrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "JavaScript source is outside the repository source directory: $resolvedSource"
    }
    $relative = $resolvedSource.Substring($sourcePrefix.Length)
    if ($relative -match '^(libs|vendor)[\\/]') { return }
    $relativeOut = [System.IO.Path]::ChangeExtension($relative, '.min.js')
    $destination = Join-Path $javascriptOut $relativeOut
    New-Item -ItemType Directory -Force (Split-Path -Parent $destination) | Out-Null

    $terserArgs = @(
        $terser,
        $resolvedSource,
        '--compress',
        '--mangle',
        '--keep-classnames',
        '--keep-fnames',
        '--ecma', '2020',
        '--output', $destination
    )
    & $node @terserArgs
    if ($LASTEXITCODE -ne 0) { throw "Terser failed for $relative" }
}

$wasmOut = Join-Path $repoRoot 'dist\wasm'
New-Item -ItemType Directory -Force $wasmOut | Out-Null
Copy-Item -LiteralPath (Join-Path $repoRoot 'wasm\dist\warriorsim.js') -Destination $wasmOut -Force
Copy-Item -LiteralPath (Join-Path $repoRoot 'wasm\dist\warriorsim.wasm') -Destination $wasmOut -Force

& $node (Join-Path $repoRoot 'scripts\compute-build.js')
if ($LASTEXITCODE -ne 0) { throw 'Compute build identity generation failed' }

Write-Host "Built JavaScript and WASM distribution assets in $($repoRoot)\dist"
