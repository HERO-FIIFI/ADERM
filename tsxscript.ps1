# PowerShell script to fix all version numbers in imports
$uiPath = "src\components\ui"

# Get all .tsx files in the ui directory
$files = Get-ChildItem -Path $uiPath -Filter "*.tsx"

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw
    
    # Remove version numbers from all package imports
    $content = $content -replace '@(\d+\.\d+\.\d+)', ''
    
    # Write the corrected content back to the file
    Set-Content -Path $file.FullName -Value $content -NoNewline
    
    Write-Host "Fixed imports in: $($file.Name)"
}

Write-Host "All import statements have been fixed!"