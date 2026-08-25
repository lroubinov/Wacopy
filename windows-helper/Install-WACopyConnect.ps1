$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
$installDirectory = Join-Path $env:LOCALAPPDATA 'WACopyConnect'
New-Item -ItemType Directory -Force -Path $installDirectory | Out-Null

Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'powershell_ise.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match '[\\/]WACopyConnect\.ps1(?:\"|\s|$)' -and $_.CommandLine -notmatch 'Install-WACopyConnect' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'WACopyConnect.ps1') -Destination $installDirectory -Force

$shell = New-Object -ComObject WScript.Shell
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Startup')) 'WACopy Connect.lnk'
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File `"$installDirectory\WACopyConnect.ps1`""
$shortcut.WorkingDirectory = $installDirectory
$shortcut.Description = 'WACopy Connect'
$shortcut.Save()

Start-Process -FilePath $shortcut.TargetPath -ArgumentList $shortcut.Arguments -WindowStyle Hidden
[System.Windows.Forms.MessageBox]::Show('WACopy Connect הותקן ופועל באזור השעון.', 'WACopy Connect') | Out-Null
