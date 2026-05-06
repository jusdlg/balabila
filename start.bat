@echo off
start cmd /k "node server.js"
timeout /t 3 /nobreak
start cmd /k "ngrok http --url=mybilibili.ngrok-free.app 3000"