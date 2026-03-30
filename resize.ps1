Add-Type -AssemblyName System.Drawing

$sourcePath = "c:\Users\erden.aydogdu\Desktop\işplanı\project-hub\public\haklıadam.jpeg"
$out192 = "c:\Users\erden.aydogdu\Desktop\işplanı\project-hub\public\icon-192x192.png"
$out512 = "c:\Users\erden.aydogdu\Desktop\işplanı\project-hub\public\icon-512x512.png"

$img = [System.Drawing.Image]::FromFile($sourcePath)

$bmp192 = New-Object System.Drawing.Bitmap(192, 192)
$graph192 = [System.Drawing.Graphics]::FromImage($bmp192)
$graph192.DrawImage($img, 0, 0, 192, 192)
$bmp192.Save($out192, [System.Drawing.Imaging.ImageFormat]::Png)

$bmp512 = New-Object System.Drawing.Bitmap(512, 512)
$graph512 = [System.Drawing.Graphics]::FromImage($bmp512)
$graph512.DrawImage($img, 0, 0, 512, 512)
$bmp512.Save($out512, [System.Drawing.Imaging.ImageFormat]::Png)

$img.Dispose()
$bmp192.Dispose()
$bmp512.Dispose()
$graph192.Dispose()
$graph512.Dispose()

Write-Output "Images resized successfully"
