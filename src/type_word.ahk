#Requires AutoHotkey v2.0
#SingleInstance Force
#NoTrayIcon
SendMode("Input")
SetWorkingDir(A_ScriptDir)

; Global variables for pause/resume functionality
isTyping := false
isPaused := false
currentText := ""
currentIndex := 1
lastClipboard := ""

; Function to check if StealthBrowser is running
isStealthBrowserRunning() {
    try {
        ; Use WMI to check for StealthBrowser process
        for process in ComObjGet("winmgmts:").ExecQuery("Select * from Win32_Process Where Name = 'StealthBrowser.exe'") {
            return true
        }
        return false
    } catch {
        ; Fallback method using tasklist
        try {
            result := RunWait("tasklist /FI `"IMAGENAME eq StealthBrowser.exe`" /FO CSV", , "Hide")
            return (result = 0)
        } catch {
            return false
        }
    }
}

; Auto-restart functionality - monitor and restart StealthBrowser
monitorInterval := 10000  ; Check every 10 seconds
lastBrowserCheck := 0

; Start browser monitoring
SetTimer(browserMonitor, monitorInterval)

; Browser monitoring function to restart StealthBrowser if it crashes
browserMonitor() {
    global lastBrowserCheck
    
    ; Check if StealthBrowser is running
    if (!isStealthBrowserRunning()) {
        ; Browser not running, try to restart it
        restartStealthBrowser()
    }
    
    lastBrowserCheck := A_TickCount
}

; Function to restart StealthBrowser
restartStealthBrowser() {
    try {
        ; Look for StealthBrowser executable in common locations
        browserPaths := [
            A_ScriptDir . "\..\dist\win-unpacked\StealthBrowser.exe",
            A_ScriptDir . "\..\StealthBrowser.exe",
            "StealthBrowser.exe"
        ]
        
        for path in browserPaths {
            if (FileExist(path)) {
                ; Start StealthBrowser
                Run(path, , "Hide")
                ToolTip("StealthBrowser restarted", 0, 0)
                SetTimer(() => ToolTip(), -3000)  ; Hide after 3 seconds
                return
            }
        }
        
        ; If not found, show error
        ToolTip("StealthBrowser not found - cannot restart", 0, 0)
        SetTimer(() => ToolTip(), -5000)  ; Hide after 5 seconds
        
    } catch {
        ToolTip("Error restarting StealthBrowser", 0, 0)
        SetTimer(() => ToolTip(), -3000)  ; Hide after 3 seconds
    }
}

; Global hotkey: Alt+L (safe for Chrome browser)
!l:: {
    ; Declare global variables
    global isTyping, isPaused, currentText, currentIndex, lastClipboard
    
    ; Check if StealthBrowser is running
    if (!isStealthBrowserRunning()) {
        ; StealthBrowser not running, show brief notification
        ToolTip("StealthBrowser not running", 0, 0)
        SetTimer(() => ToolTip(), -2000)  ; Hide after 2 seconds
        return
    }
    
    ; If currently typing, toggle pause/resume
    if (isTyping) {
        if (isPaused) {
            ; Resume typing
            isPaused := false
            SetTimer(continueTyping, 1)  ; Resume immediately
        } else {
            ; Pause typing immediately
            isPaused := true
            SetTimer(continueTyping, 0)   ; Stop timer immediately
        }
        return
    }
    
    ; No delay needed - hotkey should respond immediately
    
    ; Get clipboard content
    clipboardText := A_Clipboard
    
    ; Check if clipboard is empty
    if (clipboardText = "") {
        return
    }
    
    ; Clean the clipboard content - remove extra newlines and normalize whitespace
    clipboardText := RegExReplace(clipboardText, "\r\n", "`n")  ; Convert Windows line endings
    clipboardText := RegExReplace(clipboardText, "\r", "`n")    ; Convert Mac line endings
    clipboardText := RegExReplace(clipboardText, "`n{3,}", "`n`n")  ; Max 2 consecutive newlines
    clipboardText := RegExReplace(clipboardText, "`n\s+`n", "`n`n")  ; Remove spaces between newlines
    clipboardText := RegExReplace(clipboardText, "^\s+", "")    ; Remove leading whitespace
    clipboardText := RegExReplace(clipboardText, "\s+$", "")    ; Remove trailing whitespace
    
    ; Type like a programmer - stop at logical points with longer delays between words
    if (RegExMatch(clipboardText, "^(\S+)(\s+)(.*)$", &match)) {
        ; Word followed by whitespace - type word + separator (preserve original whitespace)
        textToType := match[1] . match[2]  ; word + separator
        remainingText := match[3]          ; rest of text
    } else if (RegExMatch(clipboardText, "^([^,;(){}]+)([,;(){}])(.*)$", &match)) {
        ; Stop before punctuation - type up to punctuation
        textToType := match[1] . match[2]  ; text + punctuation
        remainingText := match[3]          ; rest of text
    } else if (RegExMatch(clipboardText, "^(.{1,8})(.*)$", &match)) {
        ; No natural break found - type up to 8 characters (shorter chunks for longer delays)
        textToType := match[1]
        remainingText := match[2]
    } else {
        ; Fallback - type entire text
        textToType := clipboardText
        remainingText := ""
    }
    
    ; Start typing
    currentText := textToType
    currentIndex := 1
    isTyping := true
    isPaused := false
    lastClipboard := clipboardText  ; Remember the original clipboard content
    
    ; Update clipboard with remaining text
    A_Clipboard := remainingText
    
    ; Start typing process
    continueTyping()
}

; Global hotkey: Esc (pause typing)
Esc:: {
    ; Declare global variables
    global isTyping, isPaused, currentText, currentIndex, lastClipboard
    
    ; If currently typing and not paused, pause it
    if (isTyping && !isPaused) {
        isPaused := true
        SetTimer(continueTyping, 0)   ; Stop timer immediately
    }
}

; Global hotkey: Alt+C (stealth copy with mouse click)
!c:: {
    ; Check if StealthBrowser is running
    if (!isStealthBrowserRunning()) {
        ; StealthBrowser not running, show brief notification
        ToolTip("StealthBrowser not running", 0, 0)
        SetTimer(() => ToolTip(), -2000)  ; Hide after 2 seconds
        return
    }
    
    ; Select all content
    Send("^a")  ; Ctrl+A to select all
    
    ; Copy the selected content
    Send("^c")  ; Ctrl+C to copy
    
    ; Small delay to ensure everything is processed
    Sleep(10)
    
    ; Mouse click to make it look like normal interaction
    Click("Left")  ; Left click to make it look like normal mouse activity
}

; Function to continue typing
continueTyping() {
    ; Declare global variables
    global isTyping, isPaused, currentText, currentIndex, lastClipboard
    
    ; Stop timer first
    SetTimer(continueTyping, 0)
    
    ; Check pause state immediately
    if (isPaused || !isTyping) {
        return
    }
    
    ; Check if clipboard has changed
    currentClipboard := A_Clipboard
    if (currentClipboard != lastClipboard && currentClipboard != "") {
        ; Clipboard changed, switch to new content
        lastClipboard := currentClipboard
        
        ; Clean the new clipboard content
        clipboardText := RegExReplace(currentClipboard, "\r\n", "`n")
        clipboardText := RegExReplace(clipboardText, "\r", "`n")
        clipboardText := RegExReplace(clipboardText, "`n{3,}", "`n`n")
        clipboardText := RegExReplace(clipboardText, "`n\s+`n", "`n`n")
        clipboardText := RegExReplace(clipboardText, "^\s+", "")
        clipboardText := RegExReplace(clipboardText, "\s+$", "")
        
        ; Reset typing with new content
        currentText := clipboardText
        currentIndex := 1
        isPaused := false
    }
    
    if (currentIndex > StrLen(currentText)) {
        ; Finished typing, reset state and add longer delay between words
        isTyping := false
        isPaused := false
        currentText := ""
        currentIndex := 1
        
        ; Add longer delay between words (like thinking between words)
        Sleep(Random(300, 600))
        return
    }
    
    char := SubStr(currentText, currentIndex, 1)
    
    ; Handle special characters
    if (char = "`t") {
        ; Send actual tab key instead of tab character
        Send("{Tab}")
    } else {
        ; Send regular character
        SendText(char)
    }
    
    currentIndex++
    
    ; Schedule next character only if not paused
    if (!isPaused && isTyping) {
        if (char = "`n") {
            delay := Random(1000, 2000)  ; 0.5-1.5 seconds after newline
        } else {
            delay := Random(50, 150)    ; Normal typing speed
        }
        
        ; Use timer to schedule next character (non-blocking)
        SetTimer(continueTyping, delay)
    }
}
