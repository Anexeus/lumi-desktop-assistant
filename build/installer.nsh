; Lumi is a 64-bit app. The installer itself is 32-bit, so on 32-bit Windows it used to install and then Windows said
; "This app can't run on your PC" when Lumi started. Stop at the start with a clear message instead.
!include x64.nsh

!macro customInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "Lumi needs 64-bit Windows 10 or 11.$\r$\n$\r$\nThis PC runs 32-bit Windows, so Lumi can't be installed here. (Settings > System > About shows the system type.)"
    Quit
  ${EndIf}
!macroend
