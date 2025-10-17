# Script PowerShell pour migrer automatiquement les imports de notifications
# Compatible Windows
# Exécution: .\migrate-notifications.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Migration des Imports de Notifications" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorCount = 0
$SuccessCount = 0

# Fonction pour remplacer dans un fichier
function Replace-InFile {
    param (
        [string]$FilePath,
        [string]$OldPattern,
        [string]$NewPattern
    )

    if (Test-Path $FilePath) {
        try {
            $content = Get-Content $FilePath -Raw -Encoding UTF8
            $newContent = $content -replace [regex]::Escape($OldPattern), $NewPattern

            if ($content -ne $newContent) {
                Set-Content $FilePath -Value $newContent -Encoding UTF8 -NoNewline
                Write-Host "  ✓ " -ForegroundColor Green -NoNewline
                Write-Host "Modifié: $FilePath"
                return $true
            } else {
                Write-Host "  - " -ForegroundColor Yellow -NoNewline
                Write-Host "Aucun changement: $FilePath"
                return $false
            }
        } catch {
            Write-Host "  ✗ " -ForegroundColor Red -NoNewline
            Write-Host "Erreur: $FilePath - $_"
            $script:ErrorCount++
            return $false
        }
    } else {
        Write-Host "  ✗ " -ForegroundColor Red -NoNewline
        Write-Host "Fichier introuvable: $FilePath"
        $script:ErrorCount++
        return $false
    }
}

Write-Host "Étape 1: Migration des services crypto..." -ForegroundColor Yellow
$cryptoFiles = @(
    "src\crypto\services\CryptoMarketplaceService.ts",
    "src\crypto\services\CryptoPaymentService.ts",
    "src\crypto\services\DeFiService.ts",
    "src\crypto\services\PriceOracleService.ts",
    "src\crypto\services\PropertyTokenizationService.ts",
    "src\crypto\services\SmartContractService.ts",
    "src\crypto\services\UtilityTokenService.ts"
)

foreach ($file in $cryptoFiles) {
    $modified = Replace-InFile -FilePath $file `
        -OldPattern "from '../../notifications/services/NotificationService'" `
        -NewPattern "from '../../notification'"

    if ($modified) {
        # Remplacer NotificationService par UnifiedNotificationService dans tout le fichier
        $content = Get-Content $file -Raw -Encoding UTF8
        # Remplacer seulement les instances qui ne sont pas déjà précédées de "Unified"
        $newContent = $content -replace '(?<!Unified)NotificationService(?!.*from)', 'UnifiedNotificationService'
        Set-Content $file -Value $newContent -Encoding UTF8 -NoNewline
        $script:SuccessCount++
    }
}

Write-Host ""
Write-Host "Étape 2: Migration de walletResolvers.ts..." -ForegroundColor Yellow
$walletResolver = "src\wallet\graphql\walletResolvers.ts"

if (Test-Path $walletResolver) {
    $content = Get-Content $walletResolver -Raw -Encoding UTF8

    # Remplacer les imports
    $content = $content -replace "import \{ Notification \} from '../../notifications/models/Notification';", ""
    $content = $content -replace "import \{ NotificationPreference \} from '../../notifications/models/NotificationPreference';", ""
    $content = $content -replace "import \{ NotificationService \} from '../../notifications/services/NotificationService';", ""
    $content = $content -replace "import \{ InAppNotificationService \} from '../../notifications/services/InAppNotificationService';", ""

    # Ajouter le nouvel import consolidé (après les autres imports)
    if ($content -notmatch "from '../../notification'") {
        # Trouver la dernière ligne d'import
        $lines = $content -split "`n"
        $lastImportIndex = 0
        for ($i = 0; $i -lt $lines.Count; $i++) {
            if ($lines[$i] -match "^import ") {
                $lastImportIndex = $i
            }
        }

        # Insérer le nouvel import
        $newImport = @"
import {
  Notification,
  NotificationPreference,
  UnifiedNotificationService,
  InAppNotificationService
} from '../../notification';
"@
        $lines = $lines[0..$lastImportIndex] + $newImport + $lines[($lastImportIndex + 1)..($lines.Count - 1)]
        $content = $lines -join "`n"
    }

    # Remplacer NotificationService par UnifiedNotificationService dans le code
    $content = $content -replace '(?<!Unified)NotificationService(?!.*from)', 'UnifiedNotificationService'

    Set-Content $walletResolver -Value $content -Encoding UTF8 -NoNewline
    Write-Host "  ✓ " -ForegroundColor Green -NoNewline
    Write-Host "Modifié: $walletResolver"
    $script:SuccessCount++
}

Write-Host ""
Write-Host "Étape 3: Migration des services utilisateur et auth..." -ForegroundColor Yellow
$serviceFiles = @(
    "src\auth\controllers\authControllers.ts",
    "src\users\controllers\userController.ts",
    "src\users\services\userService.ts",
    "src\wallet\services\UnifiedPaymentService.ts"
)

foreach ($file in $serviceFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw -Encoding UTF8

        # Remplacer l'import avec guillemets simples
        $content = $content -replace "from '../../services/notificationServices'", "from '../../notification'"
        # Remplacer l'import avec guillemets doubles
        $content = $content -replace 'from "../../services/notificationServices"', 'from "../../notification"'
        # Remplacer NotificationService par UnifiedNotificationService
        $content = $content -replace '(?<!Unified)NotificationService(?!.*from)', 'UnifiedNotificationService'

        Set-Content $file -Value $content -Encoding UTF8 -NoNewline
        Write-Host "  ✓ " -ForegroundColor Green -NoNewline
        Write-Host "Modifié: $file"
        $script:SuccessCount++
    } else {
        Write-Host "  ✗ " -ForegroundColor Red -NoNewline
        Write-Host "Fichier introuvable: $file"
        $script:ErrorCount++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Résumé de la Migration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Fichiers modifiés avec succès: " -NoNewline
Write-Host "$SuccessCount" -ForegroundColor Green
Write-Host "Erreurs rencontrées: " -NoNewline
Write-Host "$ErrorCount" -ForegroundColor $(if ($ErrorCount -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($ErrorCount -eq 0) {
    Write-Host "✅ Migration terminée avec succès!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Prochaines étapes:" -ForegroundColor Yellow
    Write-Host "  1. Vérifier la compilation: npx tsc --noEmit"
    Write-Host "  2. Tester l'application"
    Write-Host "  3. Supprimer l'ancien dossier: Remove-Item -Recurse -Force src\notifications\"
    Write-Host "  4. Commit les changements"
} else {
    Write-Host "⚠️  Migration terminée avec des erreurs!" -ForegroundColor Red
    Write-Host "Veuillez vérifier les fichiers manuellement."
}

Write-Host ""
Write-Host "Appuyez sur une touche pour continuer..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
