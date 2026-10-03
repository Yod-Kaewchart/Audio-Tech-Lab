Option Explicit

Dim shell, command
Set shell = CreateObject("WScript.Shell")
command = "powershell.exe -NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File ""D:\Sites\Audio Tech Labs\tools\start-web-demo.ps1"""
WScript.Quit shell.Run(command, 0, True)
