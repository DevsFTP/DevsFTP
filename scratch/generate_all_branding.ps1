# DevsFTP Automated Branding Asset Suite Generator
$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (!(Test-Path $edgePath)) {
    $edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$assetsDir = "c:\xampp\htdocs\DevsFTP\assets"
$brandingDir = "c:\xampp\htdocs\DevsFTP\assets\branding"

if (!(Test-Path $brandingDir)) {
    New-Item -ItemType Directory -Path $brandingDir -Force | Out-Null
}

$svgUrl = "file:///c:/xampp/htdocs/DevsFTP/assets/icon.svg"

$targets = @(
    @{ Path = "$assetsDir\icon.png"; Width = 512; Height = 512 },
    @{ Path = "$brandingDir\icon_512.png"; Width = 512; Height = 512 },
    @{ Path = "$brandingDir\icon_256.png"; Width = 256; Height = 256 },
    @{ Path = "$brandingDir\icon_128.png"; Width = 128; Height = 128 },
    @{ Path = "$brandingDir\icon_64.png"; Width = 64; Height = 64 },
    @{ Path = "$brandingDir\icon_48.png"; Width = 48; Height = 48 },
    @{ Path = "$brandingDir\icon_32.png"; Width = 32; Height = 32 },
    @{ Path = "$brandingDir\icon_16.png"; Width = 16; Height = 16 },
    @{ Path = "$brandingDir\tray_icon.png"; Width = 32; Height = 32 },
    @{ Path = "$brandingDir\tray_icon_16.png"; Width = 16; Height = 16 },
    @{ Path = "$brandingDir\notification_icon.png"; Width = 64; Height = 64 },
    @{ Path = "$brandingDir\folder_remote.png"; Width = 64; Height = 64 },
    @{ Path = "$brandingDir\folder_local.png"; Width = 64; Height = 64 },
    @{ Path = "$assetsDir\installerHeader.png"; Width = 150; Height = 57 },
    @{ Path = "$assetsDir\installerSidebar.png"; Width = 164; Height = 314 }
)

foreach ($target in $targets) {
    $out = $target.Path
    $w = $target.Width
    $h = $target.Height
    Write-Host "Rendering $out ($w x $h)..."
    Start-Process -FilePath $edgePath -ArgumentList "--headless", "--screenshot=`"$out`"", "--window-size=$w,$h", "--hide-scrollbars", "`"$svgUrl`"" -Wait -NoNewWindow
}

Write-Host "`n🎉 ALL DevsFTP BRANDING PNG ASSETS RENDERED SUCCESSFULLY!"
