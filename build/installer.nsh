; DevsFTP Custom NSIS Installer Script
; Adds explicit shortcut selection page during installation

!macro customHeader
  !define MUI_COMPONENTSPAGE
!macroend

!macro customComponentsPage
  Section "Desktop Shortcut" SecDesktopShortcut
    CreateShortCut "$DESKTOP\DevsFTP.lnk" "$INSTDIR\DevsFTP.exe"
  SectionEnd

  Section "Start Menu Shortcut" SecStartMenuShortcut
    CreateDirectory "$SMPROGRAMS\DevsFTP"
    CreateShortCut "$SMPROGRAMS\DevsFTP\DevsFTP.lnk" "$INSTDIR\DevsFTP.exe"
  SectionEnd
!macroend
