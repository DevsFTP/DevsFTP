# PowerShell script to register DevsFTP Start Menu, Desktop shortcuts and Windows Registry icon bindings

$exePath = "c:\xampp\htdocs\DevsFTP\dist\win-unpacked\DevsFTP.exe"
$icoPath = "c:\xampp\htdocs\DevsFTP\assets\icon.ico"

Write-Host "Registering DevsFTP Shortcuts and Icons for Windows OS..."

# 1. Desktop Shortcut
$desktopPath = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('Desktop'), "DevsFTP.lnk")
$wshShell = New-Object -ComObject WScript.Shell
$shortcut = $wshShell.CreateShortcut($desktopPath)
$shortcut.TargetPath = $exePath
$shortcut.IconLocation = "$icoPath,0"
$shortcut.WorkingDirectory = "c:\xampp\htdocs\DevsFTP\dist\win-unpacked"
$shortcut.Description = "DevsFTP Remote Development Workspace"
$shortcut.Save()
Write-Host "Desktop Shortcut registered with brand icon: $desktopPath"

# 2. Start Menu Programs Shortcut
$startMenuDir = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('StartMenu'), "Programs")
if (-not (Test-Path $startMenuDir)) {
    New-Item -ItemType Directory -Force -Path $startMenuDir | Out-Null
}
$startMenuShortcutPath = [System.IO.Path]::Combine($startMenuDir, "DevsFTP.lnk")
$smShortcut = $wshShell.CreateShortcut($startMenuShortcutPath)
$smShortcut.TargetPath = $exePath
$smShortcut.IconLocation = "$icoPath,0"
$smShortcut.WorkingDirectory = "c:\xampp\htdocs\DevsFTP\dist\win-unpacked"
$smShortcut.Description = "DevsFTP Remote Development Workspace"
$smShortcut.Save()
Write-Host "Start Menu Shortcut registered with brand icon: $startMenuShortcutPath"

# 3. Register HKCU\Software\Classes\DevsFTP DefaultIcon
try {
    $regPath = "HKCU:\Software\Classes\DevsFTP"
    if (-not (Test-Path $regPath)) { New-Item -Path $regPath -Force | Out-Null }
    Set-ItemProperty -Path $regPath -Name "(default)" -Value "DevsFTP Application" -ErrorAction SilentlyContinue

    $iconRegPath = "HKCU:\Software\Classes\DevsFTP\DefaultIcon"
    if (-not (Test-Path $iconRegPath)) { New-Item -Path $iconRegPath -Force | Out-Null }
    Set-ItemProperty -Path $iconRegPath -Name "(default)" -Value "$icoPath,0" -ErrorAction SilentlyContinue

    Write-Host "Windows Registry DefaultIcon registered for DevsFTP!"
} catch {
    Write-Host "Registry warning: $($_.Exception.Message)"
}

Write-Host "All Windows OS branding shortcuts and registry bindings updated successfully!"
