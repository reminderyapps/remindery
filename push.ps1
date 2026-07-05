# Verifizierter Push des Website-Repos - die EINZIGE erlaubte
# Push-Methode (siehe App-Repo CLAUDE.md -> "Arbeitsteilung Git-Pushes").
# Prueft hart und bricht bei jedem Fehlschlag ab, OHNE zu pushen:
#   a) Repo-Ordner heisst 'remindery-site'
#   b) origin zeigt EXAKT auf die hartkodierte Whitelist-URL
#   c) Arbeitsverzeichnis ist clean (keine uncommitteten Aenderungen)
#   d) aktueller Branch ist 'main' - nur der wird gepusht, niemals force
#
# Aufruf:  powershell -File push.ps1 [-DryRun]
#   -DryRun: alle Pruefungen laufen, der Push wird nur angezeigt.
param([switch]$DryRun)

$expectedFolder = 'remindery-site'
$expectedOrigin = 'https://github.com/reminderyapps/remindery.git'
$branch = 'main'

function Fail([string]$reason) {
    Write-Host "ABBRUCH - es wurde NICHT gepusht: $reason"
    exit 1
}

$repoRoot = $PSScriptRoot
Set-Location $repoRoot

# a) richtiger Ordner
$folder = Split-Path -Leaf $repoRoot
if ($folder -ne $expectedFolder) {
    Fail "Ordner ist '$folder', erwartet '$expectedFolder'"
}

# b) origin exakt auf der Whitelist
$origin = git remote get-url origin
if ($LASTEXITCODE -ne 0) { Fail 'kein origin konfiguriert' }
if ($origin -ne $expectedOrigin) {
    Fail "origin ist '$origin', erwartet '$expectedOrigin'"
}

# c) Arbeitsverzeichnis clean
$status = git status --porcelain
if ($LASTEXITCODE -ne 0) { Fail 'git status fehlgeschlagen' }
if ($status) { Fail 'Arbeitsverzeichnis nicht clean - erst committen' }

# d) ausschliesslich main
$current = git rev-parse --abbrev-ref HEAD
if ($LASTEXITCODE -ne 0) { Fail 'aktueller Branch nicht ermittelbar' }
if ($current -ne $branch) {
    Fail "aktueller Branch ist '$current' - gepusht wird nur '$branch'"
}

# Remote-Stand holen und zeigen, was gepusht wuerde
git fetch origin --quiet
if ($LASTEXITCODE -ne 0) { Fail 'origin nicht erreichbar (fetch fehlgeschlagen)' }

git rev-parse --verify --quiet "refs/remotes/origin/$branch" | Out-Null
if ($LASTEXITCODE -eq 0) {
    $commits = @(git log --oneline "origin/$branch..$branch")
} else {
    # Erstpush: origin/main existiert noch nicht
    $commits = @(git log --oneline $branch)
}
if ($commits.Count -eq 0) {
    Write-Host 'Nichts zu pushen - origin ist bereits aktuell.'
    exit 0
}

Write-Host "Zu pushende Commits ($branch -> origin):"
$commits | ForEach-Object { Write-Host "  $_" }

if ($DryRun) {
    Write-Host "DRY-RUN: kein Push ausgefuehrt. (Befehl waere: git push origin $branch)"
    exit 0
}

git push origin $branch
if ($LASTEXITCODE -ne 0) { Fail 'git push fehlgeschlagen' }

Write-Host 'Gepusht:'
$commits | ForEach-Object { Write-Host "  $_" }
