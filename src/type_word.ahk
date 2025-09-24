#Requires AutoHotkey v2.0
#SingleInstance Force
#NoTrayIcon
SendMode("Input")
SetWorkingDir(A_ScriptDir)

; Ensure only one instance of this script is running
if (A_IsCompiled) {
    ; If compiled, use process name
    ProcessName := "type_word.exe"
} else {
    ; If not compiled, use script name
    ProcessName := "AutoHotkey.exe"
}

; Kill any other instances of this script
try {
    for process in ComObjGet("winmgmts:").ExecQuery("Select * from Win32_Process Where Name = '" . ProcessName . "'") {
        if (process.ProcessId != DllCall("GetCurrentProcessId")) {
            Run("taskkill /F /PID " . process.ProcessId, , "Hide")
        }
    }
} catch {
    ; Ignore errors
}

; Startup notification removed


; Keep script running - prevent auto-exit
Persistent

; Global variables
isTyping := false
isPaused := false
currentText := ""
currentIndex := 1

; Function to check if StealthBrowser is running and ensure only one instance
isStealthBrowserRunning() {
    try {
        processes := []
        ; Get all StealthBrowser processes
        for process in ComObjGet("winmgmts:").ExecQuery("Select * from Win32_Process Where Name = 'StealthBrowser.exe'") {
            processes.Push(process.ProcessId)
        }
        
        ; If more than one instance, kill extra ones
        if (processes.Length > 1) {
            ; Keep the first one, kill the rest
            for i in processes {
                if (i > 1) {  ; Skip first process (index 1)
                    try {
                        Run("taskkill /F /PID " . processes[i], , "Hide")
                    } catch {
                        ; Ignore kill errors
                    }
                }
            }
            ; Multiple instances notification removed
        }
        
        return (processes.Length > 0)
    } catch {
        return false
    }
}

; Auto-restart functionality - start monitoring after a delay
monitorInterval := 10000
SetTimer(browserMonitor, monitorInterval)

browserMonitor() {
    try {
        if (!isStealthBrowserRunning()) {
            restartStealthBrowser()
        }
    } catch {
        ; Ignore errors in browser monitoring to prevent script exit
    }
}

restartStealthBrowser() {
    try {
        ; Check if StealthBrowser is already running
        if (isStealthBrowserRunning()) {
            return  ; Already running, don't start another instance
        }
        
        browserPaths := [
            A_ScriptDir . "\..\dist\StealthBrowser.exe",
            A_ScriptDir . "\..\StealthBrowser.exe",
            "StealthBrowser.exe"
        ]
        
        for path in browserPaths {
            if (FileExist(path)) {
                try {
                    Run(path, , "Hide")
                    ; StealthBrowser started notification removed
                    return
                } catch {
                    continue  ; Try next path if this one fails
                }
            }
        }
        
        ; Error notification removed
        
    } catch {
        ; Error notification removed
    }
}

; Main typing hotkey: Alt+L
!l:: {
    global isTyping, isPaused, currentText, currentIndex
    
    ; Check if StealthBrowser is running
    if (!isStealthBrowserRunning()) {
        ; StealthBrowser not running notification removed
        return
    }
    
    ; If currently typing, toggle pause/resume
    if (isTyping) {
        if (isPaused) {
            isPaused := false
            SetTimer(continueTyping, 1)
        } else {
            isPaused := true
            SetTimer(continueTyping, 0)
        }
        return
    }
    
    ; Get clipboard content
    clipboardText := A_Clipboard
    
    if (clipboardText = "") {
        ; Clipboard empty notification removed
        return
    }
    
    ; Clean clipboard content
    clipboardText := RegExReplace(clipboardText, "\r\n", "`n")
    clipboardText := RegExReplace(clipboardText, "\r", "`n")
    clipboardText := RegExReplace(clipboardText, "`n{3,}", "`n`n")
    clipboardText := RegExReplace(clipboardText, "^\s+", "")
    clipboardText := RegExReplace(clipboardText, "\s+$", "")
    
    ; Start typing
    currentText := clipboardText
    currentIndex := 1
    isTyping := true
    isPaused := false
    
    ; Register ESC hotkey
    Hotkey("Esc", pauseTyping, "On")
    
    ; Start typing process
    continueTyping()
}

; Pause function
pauseTyping() {
    global isTyping, isPaused
    
    if (isTyping && !isPaused) {
        isPaused := true
        SetTimer(continueTyping, 0)
        ; Typing paused notification removed
    }
}

; Copy hotkey: Alt+C
!c:: {
    if (!isStealthBrowserRunning()) {
        ; StealthBrowser not running notification removed
        return
    }
    
    Send("^a")
    Sleep(50)
    Send("^c")
    Sleep(50)
    Click("Left")
    ; Content copied notification removed
}

; Continue typing function
continueTyping() {
    global isTyping, isPaused, currentText, currentIndex
    
    SetTimer(continueTyping, 0)
    
    if (isPaused || !isTyping) {
        return
    }
    
    if (currentIndex > StrLen(currentText)) {
        ; Finished typing
        isTyping := false
        isPaused := false
        currentText := ""
        currentIndex := 1
        
        Hotkey("Esc", pauseTyping, "Off")
        ; Typing completed notification removed
        return
    }
    
    char := SubStr(currentText, currentIndex, 1)
    
    ; Send character
    if (char = "`t") {
        Send("{Tab}")
    } else if (char = "`n") {
        Send("{Enter}")
    } else {
        SendText(char)
    }
    
    currentIndex++
    
    ; Schedule next character
    if (!isPaused && isTyping) {
        ; Simple delays
        if (char = "`n") {
            delay := Random(500, 1000)
        } else if (char = " ") {
            delay := Random(100, 300)
        } else if (RegExMatch(char, "[A-Z]")) {
            delay := Random(150, 300)
        } else {
            delay := Random(50, 150)
        }
        
        SetTimer(continueTyping, delay)
    }
}