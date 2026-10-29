# Lumi's desktop helper. Started once by Lumi (never by the model) and fed one JSON request per line on stdin;
# answers one JSON line per request on stdout. Requests are data: nothing here evaluates text as code.
# Coordinates are physical screen pixels (the process is per-monitor DPI aware).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Drawing, System.Windows.Forms, System.Runtime.WindowsRuntime
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class LumiNative {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] public static extern void mouse_event(uint flags, int dx, int dy, int data, UIntPtr extra);
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public KEYBDINPUT ki; public long pad; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public UIntPtr extra; }
  [DllImport("user32.dll", SetLastError=true)] public static extern uint SendInput(uint n, INPUT[] inputs, int size);
  public static void TypeChar(char c) {
    var down = new INPUT { type = 1, ki = new KEYBDINPUT { wScan = c, dwFlags = 4 } };
    var up = new INPUT { type = 1, ki = new KEYBDINPUT { wScan = c, dwFlags = 4 | 2 } };
    SendInput(2, new[] { down, up }, Marshal.SizeOf(typeof(INPUT)));
  }
}
'@
[void][LumiNative]::SetProcessDpiAwarenessContext([IntPtr]::new(-4))

$UIA = [System.Windows.Automation.AutomationElement]
$CT = [System.Windows.Automation.ControlType]
$script:items = @{}   # number -> element, from the latest "elements" listing

function Rect($e) {
  $r = $e.Current.BoundingRectangle
  if ($r.IsEmpty -or [double]::IsInfinity($r.Width)) { return $null }
  @{ x = [int]$r.X; y = [int]$r.Y; w = [int]$r.Width; h = [int]$r.Height }
}

function WindowInfo($e) {
  @{ handle = [int64]$e.Current.NativeWindowHandle; title = $e.Current.Name; process = (Get-Process -Id $e.Current.ProcessId -ErrorAction SilentlyContinue).ProcessName
     pid = $e.Current.ProcessId; rect = (Rect $e); minimized = [LumiNative]::IsIconic([IntPtr]$e.Current.NativeWindowHandle) }
}

function TopWindows {
  $UIA::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition) |
    Where-Object { $_.Current.Name -and $_.Current.NativeWindowHandle -ne 0 }
}

function FindWindow($req) {
  if ($req.handle) { return $UIA::FromHandle([IntPtr][int64]$req.handle) }
  if ($req.title) {
    $t = [string]$req.title
    $w = TopWindows | Where-Object { $_.Current.Name -like "*$([System.Management.Automation.WildcardPattern]::Escape($t))*" -or
      (Get-Process -Id $_.Current.ProcessId -ErrorAction SilentlyContinue).ProcessName -like "*$([System.Management.Automation.WildcardPattern]::Escape($t))*" } | Select-Object -First 1
    if (-not $w) { throw "No open window matches '$t'." }
    return $w
  }
  $UIA::FromHandle([LumiNative]::GetForegroundWindow())
}

$Interactive = @($CT::Button, $CT::Edit, $CT::MenuItem, $CT::TabItem, $CT::CheckBox, $CT::RadioButton, $CT::ComboBox, $CT::ListItem,
  $CT::Hyperlink, $CT::TreeItem, $CT::Document, $CT::SplitButton, $CT::MenuBarItem, $CT::DataItem)

function Elements($win, $max) {
  $script:items = @{}
  $out = New-Object System.Collections.ArrayList
  $walker = [System.Windows.Automation.TreeWalker]::ControlViewWalker
  $queue = New-Object System.Collections.Queue
  $queue.Enqueue(@($win, 0))
  $n = 0
  while ($queue.Count -gt 0 -and $out.Count -lt $max -and $n -lt 4000) {
    $pair = $queue.Dequeue(); $e = $pair[0]; $depth = $pair[1]; $n++
    if ($e -ne $win) {
      $ct = $e.Current.ControlType
      $name = $e.Current.Name
      if (($Interactive -contains $ct -or ($ct -eq $CT::Text -and $name)) -and -not $e.Current.IsOffscreen) {
        $r = Rect $e
        if ($r -and $r.w -gt 1 -and $r.h -gt 1) {
          $i = $out.Count + 1
          $script:items[$i] = $e
          $value = $null
          try { $value = $e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).Current.Value } catch {}
          [void]$out.Add(@{ n = $i; type = $ct.ProgrammaticName.Replace('ControlType.', ''); name = "$name".Substring(0, [Math]::Min(90, "$name".Length))
            value = if ($value) { "$value".Substring(0, [Math]::Min(120, "$value".Length)) } else { $null }; enabled = $e.Current.IsEnabled; rect = $r })
        }
      }
    }
    if ($depth -lt 14) {
      $c = $walker.GetFirstChild($e)
      while ($c -ne $null) { $queue.Enqueue(@($c, $depth + 1)); $c = $walker.GetNextSibling($c) }
    }
  }
  ,$out
}

function Capture($rect) {
  $bmp = New-Object System.Drawing.Bitmap $rect.w, $rect.h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.CopyFromScreen($rect.x, $rect.y, 0, 0, $bmp.Size)
  $g.Dispose()
  $bmp
}

function ScreenRect($win) {
  if ($win) { $r = Rect $win; if ($r) { return $r } }
  $b = [System.Windows.Forms.SystemInformation]::VirtualScreen
  @{ x = $b.X; y = $b.Y; w = $b.Width; h = $b.Height }
}

# Windows OCR through WinRT (built into Windows 10/11, runs locally).
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' } | Select-Object -First 1
function Await($op, [Type]$t) {
  $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op))
  try { $task.Wait() } catch { $inner = $_.Exception; while ($inner.InnerException) { $inner = $inner.InnerException }; throw $inner.Message }
  $task.Result
}

function Ocr($rect) {
  # Through a temporary PNG: WinRT's decoder reliably opens files, not .NET memory streams.
  $tmp = Join-Path $env:TEMP "lumi-ocr-$PID.png"
  $bmp = Capture $rect
  $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  try {
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync($tmp)) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $soft = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $stream.Dispose()
  } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  if (-not $engine) { throw 'Windows OCR is not available (no OCR language installed).' }
  $result = Await ($engine.RecognizeAsync($soft)) ([Windows.Media.Ocr.OcrResult])
  $lines = foreach ($l in $result.Lines) {
    $w0 = $l.Words[0].BoundingRect
    @{ text = $l.Text; x = [int]($rect.x + $w0.X); y = [int]($rect.y + $w0.Y) }
  }
  ,@($lines)
}

$VK = @{ ctrl = 0x11; control = 0x11; shift = 0x10; alt = 0x12; win = 0x5B; enter = 0x0D; return = 0x0D; tab = 0x09; esc = 0x1B; escape = 0x1B
  backspace = 0x08; delete = 0x2E; del = 0x2E; space = 0x20; up = 0x26; down = 0x28; left = 0x25; right = 0x27; home = 0x24; end = 0x23
  pageup = 0x21; pagedown = 0x22; f1 = 0x70; f2 = 0x71; f3 = 0x72; f4 = 0x73; f5 = 0x74; f6 = 0x75; f7 = 0x76; f8 = 0x77; f9 = 0x78; f10 = 0x79; f11 = 0x7A; f12 = 0x7B }
function Keys([string]$combo) {
  $codes = foreach ($k in $combo.ToLower().Split('+')) {
    $k = $k.Trim()
    if ($VK.ContainsKey($k)) { $VK[$k] } elseif ($k.Length -eq 1) { [int][char]$k.ToUpper() } else { throw "Unknown key '$k'." }
  }
  foreach ($c in $codes) { [LumiNative]::keybd_event([byte]$c, 0, 0, [UIntPtr]::Zero) }
  [array]::Reverse($codes)
  foreach ($c in $codes) { [LumiNative]::keybd_event([byte]$c, 0, 2, [UIntPtr]::Zero) }
}

function Click($x, $y, $right, $double) {
  [void][LumiNative]::SetCursorPos($x, $y)
  $down = if ($right) { 0x08 } else { 0x02 }; $up = if ($right) { 0x10 } else { 0x04 }
  $times = if ($double) { 2 } else { 1 }
  for ($i = 0; $i -lt $times; $i++) { [LumiNative]::mouse_event($down, 0, 0, 0, [UIntPtr]::Zero); [LumiNative]::mouse_event($up, 0, 0, 0, [UIntPtr]::Zero) }
}

function Act($req) {
  # Acting before any look (e.g. right after opening an app): number the active window's controls first,
  # exactly as a look would, so "control 1" means what screen_look would have called control 1.
  if ($script:items.Count -eq 0) { [void](Elements (FindWindow @{}) 80) }
  $e = $script:items[[int]$req.item]
  if (-not $e) { throw "There is no item $($req.item) in the latest listing. Look at the screen again." }
  $action = [string]$req.action
  try {
    switch ($action) {
      'set' { $e.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue([string]$req.text); return 'set the value' }
      'toggle' { $e.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern).Toggle(); return 'toggled' }
      'expand' { $e.GetCurrentPattern([System.Windows.Automation.ExpandCollapsePattern]::Pattern).Expand(); return 'expanded' }
      'select' { $e.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select(); return 'selected' }
      'focus' { $e.SetFocus(); return 'focused' }
      default {
        try { $e.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); return 'invoked' } catch {}
        try { $e.GetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern).Select(); return 'selected' } catch {}
        try { $e.GetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern).Toggle(); return 'toggled' } catch {}
      }
    }
  } catch { if ($action -ne 'click' -and $action) { throw "That control does not support '$action'." } }
  $r = Rect $e   # no pattern: click its centre like a person would
  if (-not $r) { throw 'That control has no position on screen.' }
  Click ([int]($r.x + $r.w / 2)) ([int]($r.y + $r.h / 2)) $false $false
  'clicked'
}

function Handle($req) {
  switch ([string]$req.op) {
    'windows' {
      $fg = [int64][LumiNative]::GetForegroundWindow()
      $list = foreach ($w in TopWindows) { $i = WindowInfo $w; $i.active = ($i.handle -eq $fg); $i }
      return ,@($list)
    }
    'look' {
      $win = FindWindow $req
      $info = WindowInfo $win
      $max = if ($req.max) { [int]$req.max } else { 80 }
      $els = Elements $win $max
      $text = $null
      if ($req.ocr -or $els.Count -lt 8) { try { $text = Ocr (ScreenRect $win) } catch { $text = @(@{ text = "(OCR failed: $($_.Exception.Message))" }) } }
      return @{ window = $info; elements = $els; text = $text }
    }
    'screen_text' { return Ocr (ScreenRect $null) }
    'screenshot' {
      $win = if ($req.handle -or $req.title) { FindWindow $req } else { $null }
      $bmp = Capture (ScreenRect $win)
      $scale = [Math]::Min(1, 1280 / $bmp.Width)
      $small = New-Object System.Drawing.Bitmap $bmp, ([int]($bmp.Width * $scale)), ([int]($bmp.Height * $scale))
      $ms = New-Object System.IO.MemoryStream
      $small.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose(); $small.Dispose()
      return @{ png = [Convert]::ToBase64String($ms.ToArray()) }
    }
    'focus' {
      $win = FindWindow $req; $h = [IntPtr]$win.Current.NativeWindowHandle
      if ([LumiNative]::IsIconic($h)) { [void][LumiNative]::ShowWindow($h, 9) }
      Keys 'alt' # Windows only lets the foreground process change focus; a key press counts as user input
      [void][LumiNative]::SetForegroundWindow($h)
      return WindowInfo $win
    }
    'window' {
      $win = FindWindow $req; $h = [IntPtr]$win.Current.NativeWindowHandle
      switch ([string]$req.action) {
        'minimize' { [void][LumiNative]::ShowWindow($h, 6) }
        'maximize' { [void][LumiNative]::ShowWindow($h, 3) }
        'restore' { [void][LumiNative]::ShowWindow($h, 9) }
        'close' { $win.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern).Close() }
        default { throw 'Unknown window action.' }
      }
      return @{ done = $req.action }
    }
    'act' { return @{ done = (Act $req) } }
    'type' { foreach ($c in ([string]$req.text).ToCharArray()) { [LumiNative]::TypeChar($c) }; if ($req.enter) { Keys 'enter' }; return @{ done = 'typed' } }
    'keys' { Keys ([string]$req.keys); return @{ done = 'pressed' } }
    'click' { Click ([int]$req.x) ([int]$req.y) ([bool]$req.right) ([bool]$req.double); return @{ done = 'clicked' } }
    'scroll' {
      if ($req.x -ne $null) { [void][LumiNative]::SetCursorPos([int]$req.x, [int]$req.y) }
      [LumiNative]::mouse_event(0x0800, 0, 0, [int](120 * [int]$req.amount), [UIntPtr]::Zero)
      return @{ done = 'scrolled' }
    }
    'ping' { return @{ ok = $true } }
    default { throw "Unknown operation." }
  }
}

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$stdin = [Console]::In
while (($line = $stdin.ReadLine()) -ne $null) {
  $id = $null
  try {
    $req = $line | ConvertFrom-Json
    $id = $req.id
    $result = Handle $req
    $json = @{ id = $id; ok = $true; result = $result } | ConvertTo-Json -Depth 8 -Compress
  } catch {
    $json = @{ id = $id; ok = $false; error = $_.Exception.Message } | ConvertTo-Json -Compress
  }
  [Console]::Out.WriteLine($json)
  [Console]::Out.Flush()
}
