# AI Town Life

A lightweight, friendly multi-agent town life simulation prototype.

The first release focuses on a complete playable loop without external dependencies: residents, places, tasks, mood, energy, relationships, memories, event feed, town tips, and daily reports. Later, `services/narrator.js` can be replaced with a real LLM or multi-agent backend without rewriting the UI.

## Run Locally

```powershell
cd ai-town-life
node scripts/server.mjs
```

Open:

```text
http://127.0.0.1:4173
```

Any static file server can also host this directory.

## Enable MiniMax Agent Mode

The UI works without MiniMax, but the `🤖 AI 管家安排` button needs a server-side API key.

Recommended local setup:

```powershell
cd ai-town-life
Copy-Item config.example.json config.local.json
```

Edit `config.local.json`:

```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 4173
  },
  "minimax": {
    "apiStyle": "anthropic",
    "apiKey": "your_real_key_here",
    "model": "MiniMax-M3",
    "anthropicBaseUrl": "https://api.minimaxi.com/anthropic",
    "timeoutMs": 30000
  }
}
```

Then run:

```powershell
node scripts/server.mjs
```

`config.local.json` is ignored by git so your key does not get committed.

Environment variables still work and take priority over `config.local.json`.

PowerShell example:

```powershell
cd ai-town-life
$env:ANTHROPIC_API_KEY="your_real_key_here"
$env:MINIMAX_MODEL="MiniMax-M3"
$env:MINIMAX_API_STYLE="anthropic"
node scripts/server.mjs
```

Then open:

```text
http://127.0.0.1:4173
```

Click `🤖 AI 管家安排`. The server sends the current town state to MiniMax and applies the returned resident task plan.

### API Style Configuration

Two API styles are supported:

| Style | Endpoint | Use Case |
|-------|----------|----------|
| `anthropic` (default) | `${anthropicBaseUrl}/v1/messages` | MiniMax-M3 with Anthropic Messages API |
| `openai` | `${baseUrl}/chat/completions` | MiniMax-M2.1 OpenAI-compatible API |

Set via `MINIMAX_API_STYLE` environment variable or `minimax.apiStyle` in config.

### Environment Variables

```text
ANTHROPIC_API_KEY        MiniMax API key (takes priority)
MINIMAX_API_KEY          MiniMax API key (fallback)
MINIMAX_API_STYLE        "anthropic" or "openai" (default: anthropic)
MINIMAX_MODEL            Model name (default: MiniMax-M3)
ANTHROPIC_BASE_URL       Anthropic endpoint (default: https://api.minimaxi.com/anthropic)
MINIMAX_BASE_URL         OpenAI endpoint (default: https://api.minimax.io/v1)
```

Do not put real API keys in frontend files, config.example.json, or README. Keep them only in `config.local.json` or environment variables.

## Open On Phone

Use this when your phone and computer are on the same Wi-Fi network:

```powershell
cd ai-town-life
npm run mobile
```

The terminal prints one or more LAN URLs, for example:

```text
Mobile/LAN URLs:
  http://192.168.1.23:4173
```

Open that URL on your phone browser.

To print the phone URLs again without starting another server:

```powershell
npm run mobile-info
```

If the phone cannot open it:

- Make sure the phone and computer are on the same Wi-Fi.
- Use the LAN URL printed by the terminal, not `127.0.0.1`.
- Allow Node.js through Windows Firewall for private networks.
- Some public or office Wi-Fi networks block device-to-device access; use a personal hotspot or deploy to Netlify/Vercel instead.

## Open From A Different Network

LAN URLs such as `192.168.x.x` only work when the phone and computer are on the same local network.

If the phone is not on the same network, use one of these:

1. Deploy as a static site.
   This is the best option for this project because it has no backend dependency. Netlify, Vercel, or GitHub Pages can host it directly.

2. Use a temporary public tunnel.
   Start the local server, then expose it with a tunnel tool:

```powershell
node scripts/server.mjs
```

In another terminal:

```powershell
cloudflared tunnel --url http://127.0.0.1:4173
```

or:

```powershell
ngrok http 4173
```

or:

```powershell
npx localtunnel --port 4173
```

Print a quick reminder:

```powershell
npm run remote-info
```

For sharing with others or testing repeatedly on phone, deploy to Netlify/Vercel/GitHub Pages instead of relying on a tunnel.

## Check

```powershell
node scripts/check.mjs
```

The check initializes a town, advances morning, afternoon, and evening, then verifies that the app reaches day 2 and creates one daily report.

## Features

- 5 residents and 5 town places
- Morning, afternoon, and evening phases
- Animated 2D town stage with moving resident tokens
- In-stage task badges, resident status colors, and compact HUD legend
- Resident spotlight panel driven by stage/card selection
- One-click `Run Day` progression
- `Auto Play` mode for watching the town evolve without manual clicks
- Town goal tracker with progress bars
- Optional MiniMax planning button for LLM-driven resident assignments
- Per-resident task assignment
- Rule-driven resident behavior based on task, energy, preference, and town state
- Mood, energy, comfort, supplies, and spirit updates
- Relationship changes when residents meet in the same place
- Event feed, recent memories, relationship ranking, town tips, and daily report
- localStorage persistence with recovery if saved state is incompatible
- No runtime dependencies, suitable for static deployment

## Architecture

```text
src/
  app.js                 # App entry, state commits, render fallback
  assets/
    town-scene.svg       # Visual asset, favicon, manifest icon
  data/
    seed.js              # Initial residents, places, tasks
  domain/
    simulation.js        # Phase advancement and state updates
    selectors.js         # Derived UI data and town tips
    state.js             # Initial state
  services/
    narrator.js          # Event copy and daily reports
    persistence.js       # localStorage read/write/validation
  ui/
    render.js            # DOM rendering and UI event binding
```

Module boundaries:

- `domain/` does not depend on the DOM and can move to a server or test runner.
- `services/narrator.js` is the future LLM integration point.
- `ui/render.js` displays state and emits user events, but does not mutate domain state directly.

## Deploy

### Netlify

`netlify.toml` is included. Use:

```text
Base directory: ai-town-life
Build command: empty
Publish directory: .
```

### GitHub Pages

Publish the contents of `ai-town-life` as a static site. `.nojekyll` is included so asset paths stay untouched.

### Vercel

Import as a static site:

```text
Framework Preset: Other
Output Directory: .
```

## Product Roadmap

1. Resident detail modal and town calendar.
2. Building upgrades, town events, and achievements.
3. Replace `narrator.js` with an LLM narration service.
4. User-created residents and places.
5. Exportable daily reports and shareable town state.
