# ARCADE 2.0 — How To Run & Extend

Quick reference for running the project locally and adding new games later.

---

## 🚀 Running Locally

### One-time setup
Make sure Python 3 is installed:
```powershell
py --version
```
Should print something like `Python 3.10.x`.

### Start the server
```powershell
cd C:\Users\CFM\Desktop\FPS_SHOOTER\Website
py server.py
```

You'll see:
```
==============================================================
  ARCADE 2.0  --  Local Development Server
==============================================================

  Serving:  C:\Users\CFM\Desktop\FPS_SHOOTER\Website

  Portal:   http://127.0.0.1:8000/
  Game:     http://127.0.0.1:8000/game/
  LAN:      http://192.168.x.x:8000/

  Press Ctrl+C to stop.
==============================================================
```

### Open in browser
- **Portal (games website):** http://127.0.0.1:8000/
- **FPS game directly:** http://127.0.0.1:8000/game/

### Stop the server
Press `Ctrl+C` in the PowerShell window.

### Port already in use?
The server automatically walks forward — if 8000 is busy, it tries 8001, 8002, up to 8019. Just use whatever port it prints.

### Verbose logging
```powershell
py server.py --verbose
```
Logs every request. Useful for debugging 404s.

---

## 📁 Folder Structure

```
Website/
├── server.py                    ← local dev server
├── vercel.json                  ← Vercel deploy config
├── HOW_TO_RUN.md                ← this file
├── README.md
│
├── portal/                      ← OUTER SHELL (the games website)
│   ├── index.html
│   ├── portal.css
│   ├── portal.js
│   ├── games.json               ← game list — edit this to add games
│   └── thumbnails/              ← game preview images (add later)
│
└── games/                       ← every game lives in its own folder
    └── fps-shooter/             ← FPS game
        ├── index.html
        ├── style.css
        ├── script.js
        ├── vendor/              ← Three.js files (local copies)
        ├── audio/
        ├── enemies/
        ├── images/
        ├── maps/
        └── weapons/
```

**Key idea:** each game is 100% self-contained. Deleting a game folder doesn't break the portal. Adding a game folder doesn't affect others.

---

## 🎮 How To Add A New Game (When You're Ready)

Suppose you built a puzzle game. Here's the 4-step process:

### 1. Create the game folder
```
Website/games/puzzle-blitz/
├── index.html
├── style.css
└── script.js
```
Your game just needs to be a normal HTML page. Any tech works — vanilla JS, canvas, Phaser, Three.js, whatever.

### 2. Add a thumbnail (optional)
Put a 400×225 JPEG at:
```
Website/portal/thumbnails/puzzle-blitz.jpg
```
If you skip this, the portal shows a text fallback (the first 3 letters of the title).

### 3. Add an entry to `portal/games.json`
Find the `games` array and add:
```json
{
  "id": "puzzle-blitz",
  "title": "Puzzle Blitz",
  "description": "Match blocks against the clock.",
  "category": "Puzzle",
  "thumbnail": "/portal/thumbnails/puzzle-blitz.jpg",
  "path": "/games/puzzle-blitz/index.html",
  "status": "live",
  "featured": false,
  "tags": ["2D", "Casual", "Timed"]
}
```

Or **replace** one of the existing `placeholder-XX` entries.

### 4. Refresh the portal
The new game appears automatically. **No code changes.**

---

## ✏️ Editing The Game List

`portal/games.json` is the single source of truth. Everything is driven by it:

| Field | Purpose |
|-------|---------|
| `id` | Unique identifier (used in URL hash like `#game=puzzle-blitz`) |
| `title` | Card title |
| `description` | 1-2 sentences, shown on the card |
| `category` | Groups with tabs — must match a category in the top of the file |
| `thumbnail` | Path to preview image |
| `path` | URL to the game's HTML — **the game loads only when clicked** |
| `status` | `"live"` = playable, `"coming-soon"` = greyed out |
| `featured` | `true` = shown in the big hero section at the top |
| `tags` | Small chips shown on the card |

### Adding a new category
Edit the `categories` array at the top of `games.json`:
```json
"categories": ["All", "Action", "Shooter", "Puzzle", "Arcade", "Strategy", "Racing", "Sports"]
```
The new tab appears automatically.

---

## 🎯 The FPS Game — Key Files

Inside `games/fps-shooter/`:

| File | What it does |
|------|--------------|
| `index.html` | Game UI — menus, HUD, loading bar |
| `style.css` | Game styling |
| `script.js` | Game engine — Three.js scene, enemies, weapons, AI |
| `vendor/` | Three.js r128 + GLTFLoader + SkeletonUtils (local copies) |
| `enemies/` | Enemy models — zombies, characters |
| `weapons/` | Weapon models |
| `maps/` | Playable maps — 2m, 3m, 4m, castle |
| `audio/` | Sound effects |
| `images/` | Sky texture and UI icons |

### The vendor folder
Three.js is loaded from `games/fps-shooter/vendor/` — **not from a CDN**. That means:
- No external dependency
- Works on any network (school, corporate, offline)
- Faster on Vercel
- Real progress tracking during load

If `vendor/` is missing or empty, the game won't start. See the next section for download links.

---

## 📦 Three.js Vendor Files (One-Time Download)

Put these three files into `games/fps-shooter/vendor/`:

1. `three.min.js` — https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
2. `GLTFLoader.js` — https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js
3. `SkeletonUtils.js` — https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/utils/SkeletonUtils.js

Right-click each link → **Save Link As** → save with the exact filename shown above.

---

## 🌐 Deploying To Vercel

### First time
1. Push this whole `Website/` folder to your GitHub repo
2. Go to https://vercel.com/new
3. Import the GitHub repo
4. Vercel auto-detects it's a static site
5. Click Deploy

### After that
Every `git push` triggers an automatic redeploy. No manual steps.

### URL structure on Vercel
- `/` → portal (ARCADE 2.0)
- `/game` → FPS game directly
- Everything else → served from the file's path

`vercel.json` handles routing + cache headers automatically.

---

## 🐛 Common Issues

### "This site can't be reached" at 127.0.0.1:8000
The server isn't running. Run `py server.py`.

### 404 for `portal.css` or `portal.js`
Paths in `index.html` must start with `/portal/`. If you see `/portal.css` in the error, the HTML has a relative path — should be `/portal/portal.css`.

### Game shows blank screen
Open DevTools (F12) → Console. Most likely:
- `_v1 already declared` → duplicate script tags or duplicate code
- `THREE is not defined` → vendor files missing from `games/fps-shooter/vendor/`
- 404 for a `.glb` → wrong path in `script.js`

### Vercel deploy says "not found" for a game
The `path` in `games.json` must match the actual file location. All paths should start with `/games/<game-id>/`.

---

## 🧠 Design Decisions (Why Things Are This Way)

- **Portal + game are separate folders** — so adding game #2 doesn't touch the FPS game
- **Everything driven by `games.json`** — no hardcoded game lists in the code
- **Lazy iframe loading** — the game only downloads when clicked, not on portal load
- **Local Three.js vendor** — no CDN dependency, accurate load progress
- **IIFE in the game** — no globals leak, safe when 20 games are on one page
- **`destroyGame()` on exit** — GPU memory is freed when you leave a game
- **Cache headers split by type** — HTML never caches (updates immediately), assets cache hard (instant repeat visits)

---

## 📌 Quick Command Cheatsheet

```powershell
# Run local server
cd C:\Users\CFM\Desktop\FPS_SHOOTER\Website
py server.py

# Run with verbose logging
py server.py --verbose

# Run on a specific port
py server.py 8080

# Push updates
git add .
git commit -m "your message"
git push

# Undo last commit (keep files)
git reset --soft HEAD~1

# Undo last commit (delete changes too)
git reset --hard HEAD~1
```