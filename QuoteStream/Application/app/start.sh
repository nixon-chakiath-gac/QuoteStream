docker compose up -d --build
sleep 15
curl -s -m 2 -X POST http://localhost:8090/warm >/dev/null 2>&1 || true
echo "App: http://localhost:3000"
