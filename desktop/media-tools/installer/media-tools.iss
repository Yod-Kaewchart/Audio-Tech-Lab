; Audio Tech Labs Media Tools — INTERNAL Windows x64 installer.
; Compile via scripts/build-installer.cjs to verify the portable payload first.
; Per-user installation. Profile data lives outside {app} and is never deleted.
#ifndef SourceRoot
  #error SourceRoot must be passed from build-installer.cjs
#endif
#ifndef OutputDir
  #error OutputDir must be passed from build-installer.cjs
#endif
#ifndef IconFile
  #error IconFile must be passed from build-installer.cjs
#endif
#ifndef MyAppVersion
  #error MyAppVersion must be passed from build-installer.cjs
#endif
#define MyExeName "Audio Tech Labs Media Tools.exe"
#ifdef TestBuild
  #define MyAppName "Audio Tech Labs Media Tools (Installer QA)"
  #define MyAppId "AudioTechLabs.MediaTools.InternalQA"
  #define MyFolder "Audio Tech Labs Media Tools Installer QA"
  #define MyOutputName "Audio-Tech-Labs-Media-Tools-Setup-" + MyAppVersion + "-Win64-QA"
#else
  #define MyAppName "Audio Tech Labs Media Tools"
  #define MyAppId "AudioTechLabs.MediaTools"
  #define MyFolder "Audio Tech Labs Media Tools"
  #define MyOutputName "Audio-Tech-Labs-Media-Tools-Setup-" + MyAppVersion + "-Win64"
#endif

[Setup]
AppId={#MyAppId}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
AppPublisher=Audio Tech Labs
AppPublisherURL=https://www.audiotechlabs.com/
DefaultDirName={localappdata}\Programs\{#MyFolder}
DefaultGroupName={#MyAppName}
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
DisableDirPage=no
DisableProgramGroupPage=yes
AllowNoIcons=no
UninstallDisplayIcon={app}\app-icon.ico
OutputDir={#OutputDir}
OutputBaseFilename={#MyOutputName}
SetupIconFile={#IconFile}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=no
RestartApplications=no
ChangesAssociations=no
Uninstallable=yes
UsePreviousAppDir=yes
MinVersion=10.0
VersionInfoDescription=Audio Tech Labs Media Tools internal Windows installer
VersionInfoCompany=Audio Tech Labs
VersionInfoVersion={#MyAppVersion}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create Desktop shortcut"; GroupDescription: "Shortcuts:"; Flags: unchecked

[Files]
Source: "{#SourceRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "{#IconFile}"; DestDir: "{app}"; DestName: "app-icon.ico"; Flags: ignoreversion

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\app-icon.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyExeName}"; WorkingDir: "{app}"; IconFilename: "{app}\app-icon.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyExeName}"; Description: "Launch {#MyAppName}"; Flags: nowait postinstall skipifsilent
