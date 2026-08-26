Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Security
Add-Type -AssemblyName System.Net.Http

Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

public sealed class WACopyHotKeyWindow : NativeWindow, IDisposable {
    public event EventHandler HotKeyPressed;
    private const int WM_HOTKEY = 0x0312;
    private const uint MOD_NOREPEAT = 0x4000;
    private uint currentModifiers;
    private uint currentKey;

    [DllImport("user32.dll")]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint modifiers, uint key);
    [DllImport("user32.dll")]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    public WACopyHotKeyWindow(uint modifiers, uint key) {
        CreateHandle(new CreateParams());
        if (!ChangeHotKey(modifiers, key))
            throw new InvalidOperationException("Unable to register the selected shortcut.");
    }

    public bool ChangeHotKey(uint modifiers, uint key) {
        if (currentKey != 0) UnregisterHotKey(Handle, 1);
        if (RegisterHotKey(Handle, 1, modifiers | MOD_NOREPEAT, key)) {
            currentModifiers = modifiers;
            currentKey = key;
            return true;
        }
        if (currentKey != 0) RegisterHotKey(Handle, 1, currentModifiers | MOD_NOREPEAT, currentKey);
        return false;
    }

    protected override void WndProc(ref Message message) {
        if (message.Msg == WM_HOTKEY && message.WParam.ToInt32() == 1) {
            EventHandler handler = HotKeyPressed;
            if (handler != null) handler(this, EventArgs.Empty);
        }
        base.WndProc(ref message);
    }

    public void Dispose() {
        UnregisterHotKey(Handle, 1);
        DestroyHandle();
    }
}

public static class WACopyNativeInput {
    private const byte VK_CONTROL = 0x11;
    private const byte VK_SHIFT = 0x10;
    private const byte VK_MENU = 0x12;
    private const byte VK_V = 0x56;
    private const uint KEYEVENTF_KEYUP = 0x0002;

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll")]
    private static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extraInfo);

    public static void PasteClipboard() {
        for (int attempt = 0; attempt < 60; attempt++) {
            bool released = (GetAsyncKeyState(VK_CONTROL) & 0x8000) == 0 &&
                            (GetAsyncKeyState(VK_SHIFT) & 0x8000) == 0 &&
                            (GetAsyncKeyState(VK_MENU) & 0x8000) == 0;
            if (released) break;
            Thread.Sleep(10);
        }
        Thread.Sleep(40);
        keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
        keybd_event(VK_V, 0, 0, UIntPtr.Zero);
        keybd_event(VK_V, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }
}
"@

$script:AppDirectory = Join-Path $env:LOCALAPPDATA 'WACopyConnect'
$script:SettingsPath = Join-Path $script:AppDirectory 'settings.json'
$script:LatestText = ''
$script:LatestKind = ''
$script:LatestImageUrl = ''
$script:LatestMessageId = ''
$script:LastNotifiedMessageId = ''
$script:Polling = $false
$script:Status = 'ממתין להגדרה'

New-Item -ItemType Directory -Force -Path $script:AppDirectory | Out-Null

function Protect-Token([string]$Token) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Token)
    $protected = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    return [Convert]::ToBase64String($protected)
}

function Unprotect-Token([string]$Value) {
    try {
        $protected = [Convert]::FromBase64String($Value)
        $bytes = [Security.Cryptography.ProtectedData]::Unprotect($protected, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
        return [Text.Encoding]::UTF8.GetString($bytes)
    } catch { return '' }
}

function Load-Settings {
    if (-not (Test-Path -LiteralPath $script:SettingsPath)) { return $null }
    try {
        $saved = Get-Content -Raw -LiteralPath $script:SettingsPath | ConvertFrom-Json
        $hotKey = if ($saved.HotKey) { [string]$saved.HotKey } else { 'Ctrl+Shift+V' }
        return [pscustomobject]@{ Url = [string]$saved.Url; Token = Unprotect-Token ([string]$saved.ProtectedToken); HotKey = $hotKey }
    } catch { return $null }
}

function Save-Settings([string]$Url, [string]$Token, [string]$HotKey) {
    $value = [ordered]@{ Url = $Url.Trim().TrimEnd('/'); ProtectedToken = Protect-Token $Token.Trim(); HotKey = $HotKey }
    $value | ConvertTo-Json | Set-Content -LiteralPath $script:SettingsPath -Encoding UTF8
    $script:Settings = Load-Settings
}

function Get-HotKeyDefinition([string]$Name) {
    switch ($Name) {
        'Ctrl+Alt+V' { return @{ Modifiers = 3; Key = 0x56 } }
        'Alt+Shift+V' { return @{ Modifiers = 5; Key = 0x56 } }
        'Ctrl+Shift+Insert' { return @{ Modifiers = 6; Key = 0x2D } }
        'F8' { return @{ Modifiers = 0; Key = 0x77 } }
        'F9' { return @{ Modifiers = 0; Key = 0x78 } }
        default { return @{ Modifiers = 6; Key = 0x56 } }
    }
}

function Apply-HotKey([string]$Name) {
    $definition = Get-HotKeyDefinition $Name
    if ($script:HotKey -and -not $script:HotKey.ChangeHotKey([uint32]$definition.Modifiers, [uint32]$definition.Key)) {
        return $false
    }
    if ($script:PasteItem) { $script:PasteItem.Text = "הדבקת התוכן האחרון  $Name" }
    return $true
}

function New-Request([System.Net.Http.HttpMethod]$Method, [string]$Path) {
    $request = [Net.Http.HttpRequestMessage]::new($Method, "$($script:Settings.Url)$Path")
    $request.Headers.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $script:Settings.Token)
    return $request
}

function Show-Balloon([string]$Title, [string]$Message, [System.Windows.Forms.ToolTipIcon]$Icon = [System.Windows.Forms.ToolTipIcon]::Info) {
    $script:Tray.BalloonTipTitle = $Title
    $script:Tray.BalloonTipText = $Message
    $script:Tray.BalloonTipIcon = $Icon
    $script:Tray.ShowBalloonTip(2500)
}

function Update-Status([string]$Value) {
    $script:Status = $Value
    $script:StatusItem.Text = "מצב: $Value"
    $script:Tray.Text = "WACopy Connect — $Value"
}

function Poll-Latest {
    if ($script:Polling -or -not $script:Settings) { return }
    $script:Polling = $true
    try {
        $request = New-Request ([Net.Http.HttpMethod]::Get) '/api/windows/latest'
        $response = $script:Http.SendAsync($request).GetAwaiter().GetResult()
        if ($response.StatusCode -eq [Net.HttpStatusCode]::Unauthorized) { Update-Status 'מפתח התקן שגוי'; return }
        if (-not $response.IsSuccessStatusCode) { Update-Status "שגיאת שרת $([int]$response.StatusCode)"; return }
        $data = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
        $script:LatestText = [string]$data.text
        $script:LatestKind = [string]$data.kind
        $script:LatestImageUrl = [string]$data.imageUrl
        $script:LatestMessageId = [string]$data.id
        Update-Status 'מחובר'
        if ($script:LatestMessageId -and $script:LatestMessageId -ne $script:LastNotifiedMessageId) {
            $script:LastNotifiedMessageId = $script:LatestMessageId
            $contentName = if ($script:LatestKind -eq 'image') { 'תמונה חדשה' } else { 'טקסט חדש' }
            Show-Balloon "$contentName התקבלה" "מקמו את הסמן במקום הרצוי ולחצו $($script:Settings.HotKey)."
        }
    } catch { Update-Status 'אין חיבור' }
    finally { $script:Polling = $false }
}

function Acknowledge-Paste([string]$MessageId) {
    try {
        $request = New-Request ([Net.Http.HttpMethod]::Post) '/api/windows/ack'
        $request.Content = [Net.Http.StringContent]::new((@{ messageId = $MessageId } | ConvertTo-Json -Compress), [Text.Encoding]::UTF8, 'application/json')
        $null = $script:Http.SendAsync($request).GetAwaiter().GetResult()
    } catch { }
}

function Paste-Latest {
    if (-not $script:LatestMessageId) {
        Show-Balloon 'אין תוכן להדבקה' 'שלחו קודם טקסט או תמונה דרך WACopy.' ([System.Windows.Forms.ToolTipIcon]::Warning)
        return
    }
    try {
        if ($script:LatestKind -eq 'image') {
            $request = New-Request ([Net.Http.HttpMethod]::Get) $script:LatestImageUrl
            $response = $script:Http.SendAsync($request).GetAwaiter().GetResult()
            if (-not $response.IsSuccessStatusCode) { throw "Image download failed: $([int]$response.StatusCode)" }
            $bytes = $response.Content.ReadAsByteArrayAsync().GetAwaiter().GetResult()
            $stream = [IO.MemoryStream]::new([byte[]]$bytes)
            try {
                $source = [Drawing.Image]::FromStream($stream)
                try {
                    $bitmap = [Drawing.Bitmap]::new($source)
                    try { [Windows.Forms.Clipboard]::SetImage($bitmap) }
                    finally { $bitmap.Dispose() }
                } finally { $source.Dispose() }
            } finally { $stream.Dispose() }
        } else {
            [Windows.Forms.Clipboard]::SetText($script:LatestText)
        }
        [WACopyNativeInput]::PasteClipboard()
        $pastedMessageId = $script:LatestMessageId
        $script:LatestText = ''
        $script:LatestKind = ''
        $script:LatestImageUrl = ''
        $script:LatestMessageId = ''
        Acknowledge-Paste $pastedMessageId
        Show-Balloon 'התוכן הודבק' 'התוכן נמחק מהשרת.'
    } catch {
        Show-Balloon 'ההדבקה נכשלה' 'נסו שוב לאחר הצבת הסמן במקום הרצוי.' ([System.Windows.Forms.ToolTipIcon]::Error)
    }
}

function Show-Settings {
    $form = [Windows.Forms.Form]::new()
    $form.Text = 'הגדרות WACopy Connect'
    $form.Size = [Drawing.Size]::new(500, 350)
    $form.StartPosition = 'CenterScreen'
    $form.RightToLeft = 'Yes'
    $form.RightToLeftLayout = $true
    $form.FormBorderStyle = 'FixedDialog'
    $form.MaximizeBox = $false

    $urlLabel = [Windows.Forms.Label]::new(); $urlLabel.Text = 'כתובת WACopy'; $urlLabel.Location = [Drawing.Point]::new(28, 25); $urlLabel.AutoSize = $true
    $url = [Windows.Forms.TextBox]::new(); $url.Location = [Drawing.Point]::new(28, 49); $url.Size = [Drawing.Size]::new(425, 27); $url.RightToLeft = 'No'; $url.Text = if ($script:Settings) { $script:Settings.Url } else { 'https://wacopy.lroubinov.synology.me' }
    $tokenLabel = [Windows.Forms.Label]::new(); $tokenLabel.Text = 'מפתח התקן'; $tokenLabel.Location = [Drawing.Point]::new(28, 91); $tokenLabel.AutoSize = $true
    $token = [Windows.Forms.TextBox]::new(); $token.Location = [Drawing.Point]::new(28, 115); $token.Size = [Drawing.Size]::new(425, 27); $token.RightToLeft = 'No'; $token.UseSystemPasswordChar = $true; $token.Text = if ($script:Settings) { $script:Settings.Token } else { '' }
    $help = [Windows.Forms.Label]::new(); $help.Text = 'את מפתח המחשב מעתיקים ממסך ניהול החדרים של WACopy.'; $help.Location = [Drawing.Point]::new(28, 151); $help.Size = [Drawing.Size]::new(425, 27); $help.ForeColor = [Drawing.Color]::DimGray
    $hotKeyLabel = [Windows.Forms.Label]::new(); $hotKeyLabel.Text = 'קיצור דרך להדבקה'; $hotKeyLabel.Location = [Drawing.Point]::new(28, 184); $hotKeyLabel.AutoSize = $true
    $hotKey = [Windows.Forms.ComboBox]::new(); $hotKey.Location = [Drawing.Point]::new(28, 207); $hotKey.Size = [Drawing.Size]::new(425, 28); $hotKey.DropDownStyle = 'DropDownList'; [void]$hotKey.Items.AddRange(@('Ctrl+Shift+V','Ctrl+Alt+V','Alt+Shift+V','Ctrl+Shift+Insert','F8','F9')); $hotKey.SelectedItem = if ($script:Settings) { $script:Settings.HotKey } else { 'Ctrl+Shift+V' }
    $save = [Windows.Forms.Button]::new(); $save.Text = 'שמירה'; $save.Location = [Drawing.Point]::new(353, 257); $save.Size = [Drawing.Size]::new(100, 34)
    $cancel = [Windows.Forms.Button]::new(); $cancel.Text = 'ביטול'; $cancel.Location = [Drawing.Point]::new(243, 257); $cancel.Size = [Drawing.Size]::new(100, 34)
    $save.Add_Click({
        if (-not $url.Text.StartsWith('https://') -or $token.Text.Trim().Length -lt 32) {
            [Windows.Forms.MessageBox]::Show('יש להזין כתובת HTTPS ומפתח באורך 32 תווים לפחות.', 'WACopy Connect') | Out-Null
            return
        }
        if (-not (Apply-HotKey ([string]$hotKey.SelectedItem))) {
            [Windows.Forms.MessageBox]::Show('קיצור הדרך תפוס על ידי תוכנה אחרת. בחרו קיצור אחר.', 'WACopy Connect') | Out-Null
            return
        }
        Save-Settings $url.Text $token.Text ([string]$hotKey.SelectedItem)
        Update-Status 'מתחבר'
        $form.DialogResult = 'OK'; $form.Close()
    })
    $cancel.Add_Click({ $form.Close() })
    $form.Controls.AddRange(@($urlLabel, $url, $tokenLabel, $token, $help, $hotKeyLabel, $hotKey, $save, $cancel))
    $form.ShowDialog() | Out-Null
}

$script:Settings = Load-Settings
$script:Http = [Net.Http.HttpClient]::new()
$script:Http.Timeout = [TimeSpan]::FromSeconds(5)
$script:Tray = [Windows.Forms.NotifyIcon]::new()
$script:Tray.Icon = [Drawing.SystemIcons]::Application
$script:Tray.Text = 'WACopy Connect'
$script:Tray.Visible = $true
$menu = [Windows.Forms.ContextMenuStrip]::new()
$script:StatusItem = $menu.Items.Add('מצב: מתחבר')
$script:StatusItem.Enabled = $false
$script:PasteItem = $menu.Items.Add('הדבקת התוכן האחרון')
$settingsItem = $menu.Items.Add('הגדרות')
$exitItem = $menu.Items.Add('יציאה')
$script:Tray.ContextMenuStrip = $menu
$script:PasteItem.Add_Click({ Paste-Latest })
$settingsItem.Add_Click({ Show-Settings })

$initialHotKeyName = if ($script:Settings) { $script:Settings.HotKey } else { 'Ctrl+Shift+V' }
$initialDefinition = Get-HotKeyDefinition $initialHotKeyName
$script:HotKey = [WACopyHotKeyWindow]::new([uint32]$initialDefinition.Modifiers, [uint32]$initialDefinition.Key)
$script:HotKey.add_HotKeyPressed({ Paste-Latest })
Apply-HotKey $initialHotKeyName | Out-Null
$timer = [Windows.Forms.Timer]::new(); $timer.Interval = 1200; $timer.Add_Tick({ Poll-Latest }); $timer.Start()
$context = [Windows.Forms.ApplicationContext]::new()
$exitItem.Add_Click({ $timer.Stop(); $script:Tray.Visible = $false; $script:HotKey.Dispose(); $context.ExitThread() })

if (-not $script:Settings) { Show-Settings }
Poll-Latest
[Windows.Forms.Application]::Run($context)

$timer.Dispose()
$script:Tray.Dispose()
$script:HotKey.Dispose()
$script:Http.Dispose()
