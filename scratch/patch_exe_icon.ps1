# Stop DevsFTP process if running
Stop-Process -Name "DevsFTP" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

$rcedit = (Get-ChildItem node_modules -Recurse -Filter "rcedit.exe" | Select-Object -First 1).FullName
$exePath = "c:\xampp\htdocs\DevsFTP\dist\win-unpacked\DevsFTP.exe"
$icoPath = "c:\xampp\htdocs\DevsFTP\assets\icon.ico"

Write-Host "RCEDIT executable: $rcedit"
Write-Host "Target EXE: $exePath"
Write-Host "Icon ICO: $icoPath"

& $rcedit "$exePath" --set-icon "$icoPath"
if ($LASTEXITCODE -eq 0) {
    Write-Host "SUCCESS: Executable icon successfully patched!"
} else {
    Write-Host "ERROR: rcedit failed with exit code $LASTEXITCODE"
}
