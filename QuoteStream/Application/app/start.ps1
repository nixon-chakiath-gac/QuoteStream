docker compose up -d --build
Start-Sleep -Seconds 15
try { Invoke-RestMethod -Method Post -Uri "http://localhost:8090/warm" -TimeoutSec 2 | Out-Null } catch {}
Write-Host "App: http://localhost:3000"
