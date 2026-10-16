# =============================================================================
#  SeriesTrack - preparación de la caché de winCodeSign
# =============================================================================
#  Por qué existe este script
#  --------------------------
#  Para empaquetar en Windows, electron-builder descarga el paquete "winCodeSign"
#  y lo descomprime con 7-Zip. Ese paquete incluye una carpeta `darwin` con
#  enlaces simbólicos (.dylib) que Windows NO puede crear sin privilegios
#  (requiere Modo desarrollador o una consola de administrador). El resultado es:
#
#      ERROR: Cannot create symbolic link : El cliente no dispone de un
#      privilegio requerido.
#
#  Este script descomprime el paquete excluyendo `darwin` y `linux` (que no se
#  usan para compilar en Windows: solo se necesita la parte `windows-*` y
#  `rcedit-*.exe`) y deja la caché lista con el nombre de carpeta exacto que
#  espera electron-builder: winCodeSign-2.6.0
#
#  Uso:  powershell -ExecutionPolicy Bypass -File scripts\fix-wincodesign.ps1
# =============================================================================

$ErrorActionPreference = 'Stop'

$version   = '2.6.0'
$cacheRoot = Join-Path $env:LOCALAPPDATA 'electron-builder\Cache\winCodeSign'
$target    = Join-Path $cacheRoot "winCodeSign-$version"
$url       = "https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-$version/winCodeSign-$version.7z"

Write-Host '==> SeriesTrack: preparando la cache de winCodeSign' -ForegroundColor Cyan

# 1. Comprobar si ya está lista
if (Test-Path (Join-Path $target 'windows-10')) {
    Write-Host "    Ya estaba lista: $target" -ForegroundColor Green
    exit 0
}

New-Item -ItemType Directory -Force -Path $cacheRoot | Out-Null

# 2. Localizar 7za.exe (viene con electron-builder / 7zip-bin)
$root   = Split-Path -Parent $PSScriptRoot
$cands  = @(
    (Join-Path $root 'node_modules\7zip-bin\win\x64\7za.exe'),
    (Join-Path $root 'node_modules\7zip-bin\win\ia32\7za.exe')
)
$sevenZip = $cands | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $sevenZip) {
    $sevenZip = (Get-Command 7za.exe -ErrorAction SilentlyContinue).Source
}
if (-not $sevenZip) {
    throw "No se encontro 7za.exe. Ejecuta 'npm install' antes que este script."
}
Write-Host "    Usando 7-Zip: $sevenZip"

# 3. Localizar (o descargar) el paquete .7z
$archive = Get-ChildItem -Path $cacheRoot -Filter '*.7z' -ErrorAction SilentlyContinue |
           Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $archive) {
    $archivePath = Join-Path $cacheRoot "winCodeSign-$version.7z"
    Write-Host "    Descargando $url"
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $archivePath -UseBasicParsing
    $archive = Get-Item $archivePath
} else {
    Write-Host "    Paquete encontrado en cache: $($archive.Name)"
}

# 4. Extraer excluyendo darwin y linux (los que provocan el error de symlinks)
Write-Host "    Extrayendo en $target"
New-Item -ItemType Directory -Force -Path $target | Out-Null
& $sevenZip x -bd -y '-xr!darwin' '-xr!linux' $archive.FullName "-o$target" | Out-Null

if (-not (Test-Path (Join-Path $target 'windows-10'))) {
    throw "La extraccion no produjo el contenido esperado en $target"
}

Write-Host '    Listo. Ya puedes ejecutar: npm run dist' -ForegroundColor Green
