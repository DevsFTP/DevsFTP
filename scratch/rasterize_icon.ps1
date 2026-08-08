Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$svgPath = "c:\xampp\htdocs\DevsFTP\assets\icon.svg"
$brandingDir = "c:\xampp\htdocs\DevsFTP\assets\branding"
$assetsDir = "c:\xampp\htdocs\DevsFTP\assets"

if (!(Test-Path $brandingDir)) {
    New-Item -ItemType Directory -Path $brandingDir -Force | Out-Null
}

Write-Host "Branding directory ready: $brandingDir"
