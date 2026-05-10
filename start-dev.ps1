# start-dev.ps1

#update the root according to your local path
$Root = "D:\zentra web"

function Start-DevService {
    param (
        [string]$Title,
        [string]$Path,
        [string]$Command
    )

    $SafeTitle = $Title.Replace("'", "''")
    $SafePath = $Path.Replace("'", "''")

    Start-Process powershell.exe -ArgumentList @(
        "-NoExit",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "`$Host.UI.RawUI.WindowTitle = '$SafeTitle'; Write-Host '$SafeTitle' -ForegroundColor Cyan; cd '$SafePath'; $Command"
    )
}

# RAG API - Port 8001
#Start-DevService `
#    -Title "RAG API 8001" `
#    -Path "$Root\backend\rag" `
#    -Command "python -m uvicorn api:app --reload --host 0.0.0.0 --port 8001"

# Meal Generator API - Port 8000
Start-DevService `
    -Title "Meal Generator API 8000" `
    -Path "$Root\backend\mealgenerator\apps\api\" `
    -Command "python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

# Model Gateway API - Port 8010
#Start-DevService `
#    -Title "Model Gateway API 8010" `
#    -Path "$Root\model_gateway" `
#    -Command ".\.venv\Scripts\Activate.ps1; `$env:MODEL_GATEWAY_LOAD_MODELS_ON_STARTUP='false'; python -m uvicorn app.main:app --host 0.0.0.0 --port 8010"

# Zentra Web App
Start-DevService `
    -Title "Zentra Web 5173" `
    -Path "$Root\zentra-main" `
    -Command "npm.cmd run dev"
