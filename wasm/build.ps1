param(
    [ValidateSet('Release', 'Debug')]
    [string]$Configuration = 'Release',
    [switch]$Profiling
)

$ErrorActionPreference = 'Stop'
$wasmRoot = $PSScriptRoot
$repoRoot = Split-Path -Parent $wasmRoot
$outputDir = Join-Path $wasmRoot 'dist'
$cacheDir = Join-Path $wasmRoot '.em-cache'
$outputName = if ($Profiling) { 'warriorsim.profile.js' } else { 'warriorsim.js' }
New-Item -ItemType Directory -Force $outputDir, $cacheDir | Out-Null

if (-not (Get-Command em++ -ErrorAction SilentlyContinue)) {
    $emsdkRoot = if ($env:EMSDK) { $env:EMSDK } else { Join-Path (Split-Path -Parent $repoRoot) 'emsdk' }
    $emsdkEnv = Join-Path $emsdkRoot 'emsdk_env.ps1'
    if (-not (Test-Path -LiteralPath $emsdkEnv)) {
        throw "em++ is not on PATH and no emsdk_env.ps1 was found via EMSDK or sibling ../emsdk"
    }
    . $emsdkEnv | Out-Null
}

$common = @(
    '-std=c++20',
    '-sWASM=1',
    '-sMODULARIZE=1',
    '-sEXPORT_ES6=1',
    '-sEXPORT_NAME=createWarriorSim',
    '-sENVIRONMENT=worker,node',
    '-sINCOMING_MODULE_JS_API=locateFile,wasmBinary',
    '-sALLOW_MEMORY_GROWTH=1',
    '-sSTACK_SIZE=262144',
    '-sFILESYSTEM=0',
    '-sASSERTIONS=1',
    '-fwasm-exceptions',
    '-sEXCEPTION_STACK_TRACES=1',
    '--bind',
    '-I', (Join-Path $wasmRoot 'src'),
    (Join-Path $wasmRoot 'src\engine.cpp'),
    (Join-Path $wasmRoot 'src\player.cpp'),
    (Join-Path $wasmRoot 'src\simulation.cpp'),
    (Join-Path $wasmRoot 'src\spells.cpp'),
    (Join-Path $wasmRoot 'src\auras.cpp'),
    '-o', (Join-Path $outputDir $outputName)
)

$env:EM_CACHE = $cacheDir
if ($Configuration -eq 'Release') {
    $release = @('-O3', '-flto', '-msimd128', '-DNDEBUG', '-sASSERTIONS=0')
    if ($Profiling) { $release += '--profiling-funcs' }
    & em++ @common @release
} else {
    & em++ @common '-O0' '-gsource-map'
}
if ($LASTEXITCODE -ne 0) { throw "Emscripten failed with exit code $LASTEXITCODE" }
