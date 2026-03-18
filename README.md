# LifeTracker — Phase 1A Setup Instructions

Your environment: QNAP TS-451 @ 192.168.4.62, QTS 5.2.8, Container Station 3.1.2, Windows 11

---

## STEP 1 — Copy this folder to your QNAP

1. Open File Explorer on your PC
2. In the address bar type:  \\192.168.4.62\homes
3. Press Enter
4. Open the "admin" folder
5. Copy the entire "lifetracker" folder here

Your QNAP path will be:  /share/homes/admin/lifetracker/

---

## STEP 2 — Open PuTTY and connect

- Host: 192.168.4.62
- Port: 22
- Connection type: SSH

Login with your QNAP admin username and password.

---

## STEP 3 — Verify Docker is running

In PuTTY, type:

    docker --version

Expected output:  Docker version 24.x.x, build ...

If you see "command not found" — open Container Station in your QTS browser first, wait 30 seconds, then try again.

---

## STEP 4 — Check Node.js (needed to build the image)

    node --version

If it shows v18 or higher — skip to Step 5.

If "command not found" — run these commands one at a time:

    cd /tmp
    wget https://nodejs.org/dist/v20.11.0/node-v20.11.0-linux-x64.tar.xz
    tar -xf node-v20.11.0-linux-x64.tar.xz
    cp -r node-v20.11.0-linux-x64 /share/homes/admin/node20
    echo 'export PATH=/share/homes/admin/node20/bin:$PATH' >> /root/.profile
    source /root/.profile
    node --version

Expected output: v20.11.0

---

## STEP 5 — Verify the files are in place

    ls /share/homes/admin/lifetracker/

Expected output:  app   data   docker-compose.yml   .env

    ls /share/homes/admin/lifetracker/app/

Expected output:  db   features   shared   Dockerfile   package.json   server.js

---

## STEP 6 — Build the Docker image

    cd /share/homes/admin/lifetracker
    docker-compose build

This takes 2-5 minutes the first time. You'll see many lines ending with:
  Successfully built ...
  Successfully tagged ...

---

## STEP 7 — Start the container

    docker-compose up -d

Expected output:  Creating lifetracker ... done

Confirm it is running:

    docker ps

The STATUS column must show "Up" — not "Exited".

---

## STEP 8 — Check the logs

    docker logs lifetracker

Expected output:
  apply 001_initial.sql
  Migrations complete. Applied: 1, Skipped: 0
  LifeTracker running on port 3001

---

## STEP 9 — Test in your browser

Open:  http://192.168.4.62:3001

You should see the LifeTracker placeholder page.

Then open:  http://192.168.4.62:3001/health

You should see:  {"status":"ok","version":"1.0.0",...}

---

## STEP 10 — Set your app password (first-run)

Open this URL in your browser or use any API tool:

    POST http://192.168.4.62:3001/api/v1/auth/setup
    Body: {"password": "your-chosen-password"}

Or from PuTTY using curl:

    curl -X POST http://localhost:3001/api/v1/auth/setup \
      -H "Content-Type: application/json" \
      -d '{"password":"your-chosen-password"}'

---

## Phase 1A is complete. Message Claude to start Phase 1B: Inventory.

---

## Day-to-day commands

Restart after changing a file:
    cd /share/homes/admin/lifetracker && docker-compose build && docker-compose up -d

Restart after changing only .env:
    cd /share/homes/admin/lifetracker && docker-compose restart

View logs:
    docker logs lifetracker --tail 50

Stop the app:
    cd /share/homes/admin/lifetracker && docker-compose down

Change the port: edit PORT= in the .env file, then restart.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Browser "can't reach site" | Run: docker ps — check STATUS column |
| STATUS shows "Exited" | Run: docker logs lifetracker — read the error |
| "docker: command not found" | Open Container Station in QTS browser first |
| Port 3001 already in use | Change PORT=3001 to PORT=3002 in .env, restart |
| Container keeps restarting | Syntax error in a file — check docker logs |
