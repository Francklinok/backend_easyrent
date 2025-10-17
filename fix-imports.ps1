# Script to fix apollo-server-express imports
$files = @(
    "src\graphql\combined.ts",
    "src\modules\contrat\graphql\typeDefs.ts",
    "src\property\graphql\propertySchema.ts",
    "src\service-marketplace\graphql\serviceSchema.ts"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $content = $content -replace "import { gql } from 'apollo-server-express';", "import gql from 'graphql-tag';"
        Set-Content $file $content -NoNewline
        Write-Host "Fixed: $file"
    }
}

Write-Host "Import fixes completed!"
