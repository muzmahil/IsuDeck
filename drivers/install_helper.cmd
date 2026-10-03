@echo off
setlocal enabledelayedexpansion
set "ACTION=%~1"
if /i "%ACTION%"=="/uninstall" goto :uninstall
"%~dp0install-interception.exe" /install
if %ERRORLEVEL% equ 0 exit /b 0
if exist "%SystemRoot%\System32\drivers\keyboard.sys" (
reg add "HKLM\SYSTEM\CurrentControlSet\Services\keyboard" /v DisplayName /t REG_SZ /d "Keyboard Upper Filter Driver" /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\keyboard" /v Type /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\keyboard" /v Start /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\keyboard" /v ErrorControl /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\mouse" /v DisplayName /t REG_SZ /d "Mouse Upper Filter Driver" /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\mouse" /v Type /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\mouse" /v Start /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Services\mouse" /v ErrorControl /t REG_DWORD /d 1 /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e96b-e325-11ce-bfc1-08002be10318}" /v UpperFilters /t REG_MULTI_SZ /d "keyboard\0kbdclass" /f >nul 2>&1
reg add "HKLM\SYSTEM\CurrentControlSet\Control\Class\{4d36e96f-e325-11ce-bfc1-08002be10318}" /v UpperFilters /t REG_MULTI_SZ /d "mouse\0mouclass" /f >nul 2>&1
exit /b 0
)
exit /b 1
:uninstall
"%~dp0install-interception.exe" /uninstall
exit /b %ERRORLEVEL%
