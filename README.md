# EMT Operations Resource Board — Self-Hosted

Scheduling board for the Enviromet Technologies operations team (Field Operations, Production, Engineering, IT Division and Project Managers): who is on which project, who is on site or on leave, who is free with the right skills, Selangor public holidays, and clashes to fix.

- **Zero dependencies.** It needs only Node.js 18 or newer. There is no `npm install` step.
- **One data file.** Everything lives in `data/db.json`. A dated copy is saved to `data/backups/` once a day, and the last 30 days are kept.
- **Live updates.** When one person saves, every open screen refreshes within a second.
- **Two logins.**
  - The **team login** (operations managers and PMs) can book, edit and remove.
  - An optional **view-only login** (for BD and management) can look, search and use *Who's free*, but can't change anything.

## Quick deploy (Ubuntu server, about 10 minutes)

**1. Copy this folder from your Mac to the server.** Run this in Terminal, in the folder that contains `emt-resource-board`:

```bash
scp -r emt-resource-board root@YOUR_SERVER_IP:/root/
```

**2. Log in to the server and run the installer:**

```bash
ssh root@YOUR_SERVER_IP
cd /root/emt-resource-board
sudo TEAM_PASSWORD='long-password' VIEW_PASSWORD='another-password' \
     DOMAIN='board.enviromet.my' EMAIL='you@enviromet.my' ./deploy.sh
```

- No domain yet? Leave out `DOMAIN` and `EMAIL`. The board then runs on `http://SERVER_IP:3000` without HTTPS. Add the domain later by re-running the same command with it.
- Before using `DOMAIN`, add a DNS **A record** for it that points to the server IP.

**3. Open the address the script prints and sign in:**

- **Team login:** username `emt`, with your `TEAM_PASSWORD`
- **View-only login:** username `view`, with your `VIEW_PASSWORD`

**What the installer does:**

1. Installs Node.js.
2. Runs the board as a background service that restarts automatically.
3. Keeps the data in `/var/lib/emt-resource-board`.
4. Sets up nginx and a free HTTPS certificate (when you give a `DOMAIN`).
5. Turns on the firewall.

Re-running the installer updates the app and keeps your data.

**Useful commands:**

| Task | Command |
|---|---|
| Status | `systemctl status emt-resource-board` |
| Live logs | `journalctl -u emt-resource-board -f` |
| Restart | `sudo systemctl restart emt-resource-board` |
| Change a password | Edit `/etc/emt-resource-board.env`, then restart |
| Backups | `/var/lib/emt-resource-board/backups/` |

## Folder contents

| File | Purpose |
|---|---|
| `server.js` | The web server and API |
| `public/index.html` | The board (logo embedded) |
| `data/seed.json` | Starting data: 5 operations staff, 5 EXAMPLE staff with 10 EXAMPLE bookings, 6 projects, 46 Selangor public holidays (2026–2027). Used only on first start. |
| `deploy.sh` | One-command installer for an Ubuntu server |
| `Dockerfile` | Optional, for Docker hosting |
| `.env.example` | Settings template |

## Option A — Run on a Linux server (recommended)

Use EMT's existing cloud server (the one hosting OneDesk) or any small VPS.

```bash
# 1. Copy this folder to the server, e.g. /opt/emt-resource-board
# 2. Install Node 20 if it is not there
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs

# 3. Test run
cd /opt/emt-resource-board
TEAM_PASSWORD='choose-a-long-password' PORT=3000 node server.js

# 4. Keep it running after reboot (pm2)
sudo npm install -g pm2
TEAM_PASSWORD='choose-a-long-password' VIEW_PASSWORD='another-long-password' PORT=3000 pm2 start server.js --name emt-board
pm2 save && pm2 startup
```

### Put it behind HTTPS (required: the password travels with every request)

Point a subdomain such as `board.enviromet.my` at the server, then use nginx and Let's Encrypt:

```nginx
server {
  server_name board.enviromet.my;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Connection "";
    proxy_buffering off;          # needed for live updates
    proxy_read_timeout 1h;
  }
}
```

```bash
sudo certbot --nginx -d board.enviromet.my
```

Then block port 3000 from outside, so the board can only be reached through HTTPS: `sudo ufw deny 3000`.

## Option B — Docker

```bash
docker build -t emt-board .
docker run -d --name emt-board --restart unless-stopped \
  -p 3000:3000 -e TEAM_PASSWORD='choose-a-long-password' \
  -v emt-board-data:/data emt-board
```

Put HTTPS in front of it the same way as Option A.

## Option C — Try it on your Mac first

```bash
cd "EMT Resource Board"
TEAM_PASSWORD=test node server.js
```

Open http://localhost:3000 and sign in with username `emt` and password `test`.

## Example data

On first start, the board shows 5 example people and 10 example bookings. They all carry an **EXAMPLE** tag and a dashed outline. They demonstrate:

- a site trip
- leave and MC
- part-time work
- a booking that crosses a public holiday
- some deliberate problems: a double-booking, a booking made during leave, and a booking with no job number

These problems give the Issues tab something to show.

When you are ready, sign in with the team login. Click **Remove all examples** in the yellow banner, then click again to confirm. Your real people, projects and holidays are not touched.

## Settings

| Variable | Default | Meaning |
|---|---|---|
| `TEAM_PASSWORD` | *(required)* | Shared password. The server will not start without it. |
| `TEAM_USER` | `emt` | Shared username (can edit) |
| `VIEW_PASSWORD` | *(off)* | Set this to turn on the view-only login |
| `VIEW_USER` | `view` | View-only username, e.g. for BD |
| `PORT` | `3000` | Port the server listens on |
| `DATA_DIR` | `./data` | Where `db.json` and backups are kept |
| `KEEP_BACKUPS` | `30` | Number of daily backups to keep |

## Backups and restore

- In the app, **People → Download backup** saves the full database as a JSON file.
- On the server, daily copies are kept in `data/backups/`.
- **To restore:** stop the server, copy a backup over `data/db.json`, then start the server again.
- Back up the `data/` folder off-server weekly. A disk failure loses everything since the last copy.

## Known limits

- **One shared password.** The board does not record who made each change. If you need per-person logins and an audit trail, that belongs in WorkHub.
- **Holidays follow the Selangor (HQ) calendar.** Staff working in other states see Selangor days off. Add other states' holidays as leave for the people affected.
- **The 2027 Islamic holidays are tentative.** Update them under Board → Holidays once they are gazetted.
- **Replacement days for Sunday holidays were calculated, not taken from the gazette.** Confirm them with HR.
- **Fonts load from Google Fonts.** On a network with no internet access, the page falls back to system fonts. Everything still works.
