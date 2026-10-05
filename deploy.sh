#!/usr/bin/env bash
# EMT Operations Resource Board — one-command install for Ubuntu 22.04 / 24.04
#
# Usage (run on the server, inside this folder):
#   sudo TEAM_PASSWORD='long-password' VIEW_PASSWORD='another-password' DOMAIN='board.enviromet.my' EMAIL='you@enviromet.my' ./deploy.sh
#
#   TEAM_PASSWORD  required  login for operations managers / PMs (can edit)
#   VIEW_PASSWORD  optional  view-only login (e.g. BD)
#   DOMAIN         optional  subdomain already pointed at this server -> sets up HTTPS
#   EMAIL          optional  for the HTTPS certificate notices (needed with DOMAIN)
#   PORT           optional  internal port, default 3000
#
# Safe to re-run: it updates the app files and keeps existing data.
set -euo pipefail

APP_DIR=/opt/emt-resource-board
DATA_DIR=/var/lib/emt-resource-board
PORT="${PORT:-3000}"
SRC="$(cd "$(dirname "$0")" && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
[ -n "${TEAM_PASSWORD:-}" ] || { echo "Set TEAM_PASSWORD. Example: sudo TEAM_PASSWORD='long-password' ./deploy.sh"; exit 1; }
[ ${#TEAM_PASSWORD} -ge 10 ] || { echo "TEAM_PASSWORD must be at least 10 characters."; exit 1; }

echo "==> 1/6 Installing Node.js 20 (if needed)"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 18 ]; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> 2/6 Creating service user and folders"
id emtboard >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin emtboard
mkdir -p "$APP_DIR/public" "$DATA_DIR/backups"
install -m 644 "$SRC/server.js" "$SRC/package.json" "$APP_DIR/"
install -m 644 "$SRC/public/index.html" "$APP_DIR/public/"
# Seed only matters on first start; never touch an existing db.json
[ -f "$DATA_DIR/seed.json" ] || install -m 644 "$SRC/data/seed.json" "$DATA_DIR/seed.json"
chown -R emtboard:emtboard "$DATA_DIR"

echo "==> 3/6 Writing settings to /etc/emt-resource-board.env"
umask 077
cat > /etc/emt-resource-board.env <<EOF
TEAM_USER=emt
TEAM_PASSWORD=${TEAM_PASSWORD}
VIEW_USER=view
VIEW_PASSWORD=${VIEW_PASSWORD:-}
PORT=${PORT}
HOST=127.0.0.1
DATA_DIR=${DATA_DIR}
EOF
umask 022
[ -z "${DOMAIN:-}" ] && sed -i 's/^HOST=127.0.0.1/HOST=0.0.0.0/' /etc/emt-resource-board.env

echo "==> 4/6 Installing system service (starts on boot, restarts on crash)"
cat > /etc/systemd/system/emt-resource-board.service <<EOF
[Unit]
Description=EMT Operations Resource Board
After=network.target

[Service]
User=emtboard
EnvironmentFile=/etc/emt-resource-board.env
WorkingDirectory=${APP_DIR}
ExecStart=$(command -v node) ${APP_DIR}/server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${DATA_DIR}

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now emt-resource-board
systemctl restart emt-resource-board
sleep 2
curl -fsS "http://127.0.0.1:${PORT}/healthz" >/dev/null && echo "    Board is running."

if [ -n "${DOMAIN:-}" ]; then
  echo "==> 5/6 Setting up nginx + HTTPS for ${DOMAIN}"
  apt-get install -y nginx certbot python3-certbot-nginx
  cat > /etc/nginx/sites-available/emt-resource-board <<EOF
server {
  listen 80;
  server_name ${DOMAIN};
  client_max_body_size 1m;
  location / {
    proxy_pass http://127.0.0.1:${PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_read_timeout 1h;
  }
}
EOF
  ln -sf /etc/nginx/sites-available/emt-resource-board /etc/nginx/sites-enabled/emt-resource-board
  nginx -t && systemctl reload nginx
  if [ -n "${EMAIL:-}" ]; then
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect
  else
    echo "    No EMAIL given: run 'sudo certbot --nginx -d ${DOMAIN}' to finish HTTPS."
  fi
else
  echo "==> 5/6 No DOMAIN given: skipping HTTPS. The board is on plain HTTP port ${PORT}."
fi

echo "==> 6/6 Firewall"
if command -v ufw >/dev/null; then
  ufw allow OpenSSH >/dev/null
  if [ -n "${DOMAIN:-}" ]; then ufw allow 'Nginx Full' >/dev/null; ufw deny "${PORT}" >/dev/null || true
  else ufw allow "${PORT}/tcp" >/dev/null; fi
  ufw --force enable >/dev/null
fi

IP=$(curl -fsS -4 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo
echo "Done."
if [ -n "${DOMAIN:-}" ]; then echo "  Open:  https://${DOMAIN}"; else echo "  Open:  http://${IP}:${PORT}   (no HTTPS yet: add a DOMAIN soon)"; fi
echo "  Team login:  emt / (your TEAM_PASSWORD)"
[ -n "${VIEW_PASSWORD:-}" ] && echo "  View login:  view / (your VIEW_PASSWORD)"
echo "  Data:        ${DATA_DIR}/db.json   (daily backups in ${DATA_DIR}/backups)"
echo "  Logs:        journalctl -u emt-resource-board -f"
