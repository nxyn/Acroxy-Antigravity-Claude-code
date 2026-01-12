!include "MUI2.nsh"

; Custom Section to install Claude Code
Section "Install Claude Code CLI" SecClaude
  ; Set as optional (can be unchecked)
  SectionIn 1

  DetailPrint "Checking for Node.js..."
  
  ; Check if npm is available
  nsExec::ExecToStack 'cmd /c "npm --version"'
  Pop $0 ; Return code
  Pop $1 ; Output

  ${If} $0 == 0
    DetailPrint "Node.js found. Installing Claude Code CLI..."
    
    ; Run npm install
    nsExec::ExecToLog 'cmd /c "npm install -g @anthropic-ai/claude-code"'
    
    Pop $0
    ${If} $0 == 0
       DetailPrint "Claude Code CLI installed successfully."
    ${Else}
       MessageBox MB_OK|MB_ICONEXCLAMATION "Failed to install Claude Code CLI. Please try installing it manually: npm install -g @anthropic-ai/claude-code"
    ${EndIf}
    
  ${Else}
    MessageBox MB_OK|MB_ICONEXCLAMATION "Node.js is not found in your PATH.$\n$\nTo install Claude Code, you must have Node.js installed.$\n$\nPlease install Node.js from nodejs.org and try again."
  ${EndIf}
SectionEnd
