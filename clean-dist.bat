@echo off
echo Cleaning dist directory...

REM Try to remove the directory with force
if exist dist (
    echo Attempting to remove dist directory...
    
    REM Kill any processes that might be using files in dist
    taskkill /f /im "StealthBrowser.exe" 2>nul
    taskkill /f /im "electron.exe" 2>nul
    
    REM Wait a moment for processes to close
    timeout /t 2 /nobreak >nul
    
    REM Try to remove the directory
    rmdir /s /q dist 2>nul
    
    if exist dist (
        echo Some files are locked. Trying alternative method...
        
        REM Try to remove individual files that might be locked
        del /f /q dist\win-unpacked\d3dcompiler_47.dll 2>nul
        del /f /q dist\win-unpacked\*.dll 2>nul
        
        REM Try to remove the directory again
        rmdir /s /q dist 2>nul
        
        if exist dist (
            echo Warning: Could not completely clean dist directory.
            echo Some files may be in use. Continuing with build...
        ) else (
            echo Successfully cleaned dist directory.
        )
    ) else (
        echo Successfully cleaned dist directory.
    )
) else (
    echo Dist directory does not exist. Nothing to clean.
)

echo Clean completed.
