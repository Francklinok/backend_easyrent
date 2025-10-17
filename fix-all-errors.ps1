# Script pour corriger toutes les erreurs TypeScript

Write-Host "Starting TypeScript error fixes..." -ForegroundColor Green

# 1. Trouver tous les fichiers avec des erreurs de type 'any'
$files = Get-ChildItem -Path "src" -Filter "*.ts" -Recurse

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    $modified = $false
    
    # Remplacer les paramètres _ non typés
    if ($content -match '\(_:\s*any\)') {
        $content = $content -replace '\(_:\s*any,', '(_: unknown,'
        $modified = $true
    }
    
    # Remplacer les paramètres __ non typés
    if ($content -match '\(__:\s*any\)') {
        $content = $content -replace '\(__:\s*any,', '(__: unknown,'
        $modified = $true
    }
    
    if ($modified) {
        Set-Content $file.FullName $content -NoNewline
        Write-Host "Fixed: $($file.FullName)" -ForegroundColor Yellow
    }
}

Write-Host "TypeScript error fixes completed!" -ForegroundColor Green
