#!/usr/bin/env bash
# Base App Notifications — tek komutla GET (ve isteğe bağlı POST) testi.
# Kullanım:
#   1) .env içine BASE_DASHBOARD_API_KEY=... ekle (Base Dashboard → API Key)
#   2) İsteğe bağlı: BASE_APP_NOTIFICATIONS_APP_URL=https://www.basehub.fun
#   3) ./scripts/base-notifications-test.sh
# Tüm bildirim açık kullanıcılara İngilizce toplu mesaj:
#   python3 scripts/base-notifications-broadcast.py
#   DRY_RUN=1 python3 scripts/base-notifications-broadcast.py   # sadece sayım
# Veya aynı terminal oturumunda: export BASE_DASHBOARD_API_KEY='...' sonra script.

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${BASE_DASHBOARD_API_KEY:-}" ]]; then
  echo ""
  echo ">>> BASE_DASHBOARD_API_KEY tanımlı değil."
  echo "    Base Dashboard → Settings → API Key ile anahtar al,"
  echo "    proje kökündeki .env dosyasına şunu ekle:"
  echo ""
  echo "    BASE_DASHBOARD_API_KEY=buraya_yapistir"
  echo "    BASE_APP_NOTIFICATIONS_APP_URL=https://www.basehub.fun"
  echo ""
  echo "    Sonra tekrar: ./scripts/base-notifications-test.sh"
  echo ""
  exit 1
fi

APP_URL="${BASE_APP_NOTIFICATIONS_APP_URL:-https://www.basehub.fun}"
ENC="$(APP_URL="$APP_URL" python3 -c "import os, urllib.parse; print(urllib.parse.quote(os.environ['APP_URL'], safe=''))")"

echo ""
echo "=== Adım A: Bildirim açık kullanıcılar (GET) ==="
echo "    app_url=${APP_URL}"
echo ""
curl -sS "https://dashboard.base.org/api/v1/notifications/app/users?app_url=${ENC}&notification_enabled=true" \
  -H "x-api-key: ${BASE_DASHBOARD_API_KEY}" \
  -w "\n\nHTTP:%{http_code}\n"

echo ""
echo "=== Adım B (isteğe bağlı): Tek adrese bildirim gönder (POST) ==="
echo "    Kullanım: BASE_NOTIFY_WALLET=0x... ./scripts/base-notifications-test.sh"
if [[ -n "${BASE_NOTIFY_WALLET:-}" ]]; then
  curl -sS -X POST "https://dashboard.base.org/api/v1/notifications/send" \
    -H "x-api-key: ${BASE_DASHBOARD_API_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"app_url\":\"${APP_URL}\",\"wallet_addresses\":[\"${BASE_NOTIFY_WALLET}\"],\"title\":\"BaseHub test\",\"message\":\"Terminalden test bildirimi.\",\"target_path\":\"/\"}" \
    -w "\n\nHTTP:%{http_code}\n"
else
  echo "    Atlandı (BASE_NOTIFY_WALLET tanımlı değil)."
fi
echo ""
