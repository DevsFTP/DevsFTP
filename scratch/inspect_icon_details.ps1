# Forensic Icon & Notification Inspector

Write-Host "=== 1. INSPECTING assets/icon.ico ==="
$icoPath = "c:\xampp\htdocs\DevsFTP\assets\icon.ico"
if (Test-Path $icoPath) {
    $icoBytes = [System.IO.File]::ReadAllBytes($icoPath)
    Write-Host "File size: "$icoBytes.Length" bytes"
    $count = [System.BitConverter]::ToUInt16($icoBytes, 4)
    Write-Host "ICO embedded image count: $count"
    for ($i = 0; $i -lt $count; $i++) {
        $off = 6 + ($i * 16)
        $w = $icoBytes[$off]
        if ($w -eq 0) { $w = 256 }
        $h = $icoBytes[$off + 1]
        if ($h -eq 0) { $h = 256 }
        $bpp = [System.BitConverter]::ToUInt16($icoBytes, $off + 6)
        $len = [System.BitConverter]::ToUInt32($icoBytes, $off + 8)
        $imgOff = [System.BitConverter]::ToUInt32($icoBytes, $off + 12)
        
        # Check first 4 bytes of image payload for PNG signature (0x89 50 4E 47)
        $sig = "{0:X2}{1:X2}{2:X2}{3:X2}" -f $icoBytes[$imgOff], $icoBytes[$imgOff+1], $icoBytes[$imgOff+2], $icoBytes[$imgOff+3]
        $isPng = ($sig -eq "89504E47")
        Write-Host "  Image #$($i+1): ${w}x${h}, $bpp bpp, size: $len bytes, offset: $imgOff, Format: $(if($isPng){'PNG'}else{'BMP/CUR'})"
    }
} else {
    Write-Host "ERROR: assets/icon.ico does NOT exist!"
}

Write-Host "`n=== 2. INSPECTING DevsFTP.exe ==="
$exePath = "c:\xampp\htdocs\DevsFTP\dist\win-unpacked\DevsFTP.exe"
if (Test-Path $exePath) {
    $exeItem = Get-Item $exePath
    Write-Host "DevsFTP.exe size: "$exeItem.Length" bytes, LastWriteTime: "$exeItem.LastWriteTime
} else {
    Write-Host "ERROR: DevsFTP.exe does NOT exist!"
}

Write-Host "`n=== 3. INSPECTING NOTIFICATION ICON IN APPDATA ==="
$appDataNotif = [System.IO.Path]::Combine([System.Environment]::GetFolderPath('ApplicationData'), "DevsFTP", "notification_icon.png")
Write-Host "Expected AppData Notification path: $appDataNotif"
if (Test-Path $appDataNotif) {
    $nItem = Get-Item $appDataNotif
    Write-Host "AppData notification_icon.png size: "$nItem.Length" bytes"
} else {
    Write-Host "AppData notification_icon.png does NOT exist yet!"
}

Write-Host "`n=== 4. INSPECTING SOURCE BRANDING PNGs ==="
Get-ChildItem "c:\xampp\htdocs\DevsFTP\assets\branding" | Select-Object Name, Length | Format-Table -AutoSize
