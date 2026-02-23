🤠 Showdown Saloon v4 — Deployment Guide
18 AI models. Two tables. $2/$5. Running 24/7/365.
Zero servers. Zero cost. Just GitHub.

What You're Deploying
ThingWhat it isdata-repoA GitHub repo that runs a Node.js script every 10 minutes to simulate hands and save them to history.jsonpoker-repoA GitHub Pages site — one HTML file — that reads history.json and displays everything live

STEP 1 — Create the Data Repo

Go to github.com/new
Name it exactly: showdown-saloon-data
Set it to Public ← this is critical, the poker page reads it
Click Create repository


STEP 2 — Upload Files to Data Repo
Upload these three files. Order matters for the workflow file.
Upload history.json and simulate.js

In your new repo, click Add file → Upload files
Drag history.json and simulate.js into the upload area
Click Commit changes

Upload simulate.yml (the workflow — THIS PATH MATTERS)
The workflow file must be at .github/workflows/simulate.yml. GitHub won't find it otherwise.

Click Add file → Create new file
In the filename box, type exactly:

   .github/workflows/simulate.yml
As you type each /, GitHub will visually step into a folder. You'll see breadcrumbs appear: .github/ → workflows/. That's correct.
3. Open the simulate.yml file from your downloaded files, copy the entire contents
4. Paste into the editor
5. Click Commit changes

STEP 3 — Enable and Trigger GitHub Actions

In your showdown-saloon-data repo, click the Actions tab
If you see a yellow banner saying "Workflows aren't being run on this repository" → click I understand my workflows, go ahead and enable them
In the left sidebar, click Simulate Hands
Click the Run workflow dropdown button → click Run workflow (green button)
Watch the run appear. It should take 10–15 seconds
After it finishes, go back to Code tab and click history.json — it should now show thousands of hands

If the run fails, click on it to see the error log. Most common issues:

Permission denied pushing: Go to repo Settings → Actions → General → scroll to "Workflow permissions" → select "Read and write permissions" → Save
File not found: simulate.js or history.json is missing from the repo root


STEP 4 — Create the Poker Display Repo

Go to github.com/new
Name it: showdown-saloon (or whatever you want the URL to be)
Set it to Public
Click Create repository


STEP 5 — Upload index.html

Open index.html in a text editor
Find this line near the top of the <script> section:

javascript   const DATA_URL = 'https://raw.githubusercontent.com/zengineco/showdown-saloon-data/main/history.json';

Replace zengineco with your GitHub username
Save the file
Upload it to your showdown-saloon repo: Add file → Upload files


STEP 6 — Enable GitHub Pages

In your showdown-saloon repo, click Settings
In the left sidebar, click Pages
Under "Build and deployment":

Source: Deploy from a branch
Branch: main · Folder: / (root)


Click Save
Wait 1–2 minutes, then visit:

   https://YOUR_USERNAME.github.io/showdown-saloon/

STEP 7 — Verify It Works
The page should show:

✅ Status shows ✓ LIVE (top right)
✅ Hand number counting up
✅ Cards visible on all seats
✅ Progress bar moving
✅ Rail strip showing other table

If it shows ✗ OFFLINE or "HTTP 404":

Double-check your GitHub username is correctly replaced in index.html
Confirm showdown-saloon-data repo is public
Confirm history.json exists in that repo and has real hands (not "recentHands": [])


How It Runs Forever
The GitHub Action is on a cron schedule: every 10 minutes, 24/7, forever (as long as the repo exists and Actions are enabled).
Every 10 minutes:
  GitHub spins up a Ubuntu container
  Runs: node simulate.js
  simulate.js reads history.json → simulates new hands → writes back
  ArchivistDealer[bot] commits and pushes
  Container shuts down
Cost: $0. Free tier includes 2,000 Action minutes/month. Each run uses ~0.2 minutes. 6 runs/hour × 24h × 30d = ~4,320 minutes/month...

⚠️ NOTE: At 6 runs/hour you'll exceed the free 2,000 minute limit in ~17 days.
Fix: Change the cron to */30 * * * * (every 30 minutes) in simulate.yml. At 30-min intervals: 2 runs/hour × 24 × 30 = 1,440 minutes/month. Under the limit. The simulation catches up all missed hands in each run so nothing is lost.


The Stats That Matter
Every player tracks:
StatWhat it tells youWin %Pots won / hands dealt. Basic dominance metricSD Win %Showdown wins / showdowns. True hand quality — who has the best hands at showdownRebuysHow many times a player's stack went below $40 and had to reload $400Rebuy ChipsTotal $ pumped in via rebuys. The real cost of varianceStack P&LCurrent stack − $400. Only meaningful early; rebuys distort it over time
The most honest long-run metric: Win % × average pot size. A player winning small pots frequently can rank below one winning fewer but larger pots.

Two Tables

Table 1 (Featured): Gem3, GPT5, Opus, o3, Sonnet, GLM5, Flash, Kimi, Mini
Table 2: Llama, DSV3, Qwen3, CmdA, GLM4, Grok, Phi4, Code, OSS

Both run simultaneously in simulate.js. The display shows one table at a time; click TABLE 1 / TABLE 2 to switch. The rail strip shows the most recent result from the other table.

Customization
Change hand speed: Use the speed selector (⚡/🎬/🎭/🔬) in the top right of the display.
Change cron frequency: Edit .github/workflows/simulate.yml, line - cron: '*/10 * * * *'
Change DATA_URL: It's at the top of the <script> block in index.html

Files Reference
data-repo/
├── history.json                    ← The ledger. Never delete. Never reset.
├── simulate.js                     ← The simulation engine
└── .github/
    └── workflows/
        └── simulate.yml            ← The cron job

poker-repo/
└── index.html                      ← The entire display (1 file, self-contained)

Showdown Saloon — A Zengine Production
tg.zengine.site · zengine.site · zengine.shop
