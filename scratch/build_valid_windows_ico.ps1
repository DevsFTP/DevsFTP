Add-Type -AssemblyName System.Drawing

# Creates a true Windows ICO file with proper uncompressed DIB frames + 256x256 PNG frame
$brandingDir = "c:\xampp\htdocs\DevsFTP\assets\branding"
$icoPath = "c:\xampp\htdocs\DevsFTP\assets\icon.ico"

Write-Host "Building 100% compliant Windows ICO file using System.Drawing & DIB encoders..."

$sizes = @(256, 128, 64, 48, 32, 16)

$ms = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($ms)

# Header: reserved (0), type (1 = ICO), count (6)
$writer.Write([uint16]0)
$writer.Write([uint16]1)
$writer.Write([uint16]$sizes.Count)

$imageBuffers = @()
$offset = 6 + ($sizes.Count * 16)

foreach ($s in $sizes) {
    $pngPath = Join-Path $brandingDir "icon_$s.png"
    $bmp = [System.Drawing.Bitmap]::FromFile($pngPath)

    if ($s -eq 256) {
        $bytes = [System.IO.File]::ReadAllBytes($pngPath)
    } else {
        $stream = New-Object System.IO.MemoryStream
        $bw = New-Object System.IO.BinaryWriter($stream)

        # BITMAPINFOHEADER (40 bytes)
        $bw.Write([uint32]40)
        $bw.Write([int32]$s)
        $bw.Write([int32]($s * 2))
        $bw.Write([uint16]1)
        $bw.Write([uint16]32)
        $bw.Write([uint32]0)
        $bw.Write([uint32]($s * $s * 4))
        $bw.Write([int32]0)
        $bw.Write([int32]0)
        $bw.Write([uint32]0)
        $bw.Write([uint32]0)

        # Write pixels in bottom-up BGRA format
        for ($y = $s - 1; $y -ge 0; $y--) {
            for ($x = 0; $x -lt $s; $x++) {
                $c = $bmp.GetPixel($x, $y)
                $bw.Write([byte]$c.B)
                $bw.Write([byte]$c.G)
                $bw.Write([byte]$c.R)
                $bw.Write([byte]$c.A)
            }
        }

        # Write AND mask
        $maskRowBytes = [math]::Ceiling($s / 32.0) * 4
        $andMask = New-Object byte[] ($maskRowBytes * $s)
        $bw.Write($andMask)

        $bytes = $stream.ToArray()
        $bw.Close()
        $stream.Close()
    }
    $bmp.Dispose()

    $wByte = if ($s -ge 256) { [byte]0 } else { [byte]$s }
    $hByte = if ($s -ge 256) { [byte]0 } else { [byte]$s }

    $writer.Write([byte]$wByte)
    $writer.Write([byte]$hByte)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]32)
    $writer.Write([uint32]$bytes.Length)
    $writer.Write([uint32]$offset)

    $offset += $bytes.Length
    $imageBuffers += ,$bytes
}

foreach ($buf in $imageBuffers) {
    $writer.Write($buf)
}

$icoBytes = $ms.ToArray()
$writer.Close()
$ms.Close()

[System.IO.File]::WriteAllBytes($icoPath, $icoBytes)
$len = $icoBytes.Length
Write-Host "SUCCESS: Built 100% compliant Windows ICO file ($len bytes)!"
