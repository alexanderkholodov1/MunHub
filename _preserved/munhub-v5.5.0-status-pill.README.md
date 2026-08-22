# MunHub v5.5.0 — the status pill stops calling a silent detector a backend failure

Built and verified on Beacon, 2026-08-17, in response to operator order `5e4608dd` (2026-08-12).
**Not committed:** this session's harness blocked `git commit` in a repository outside its primary
working directory. The work is complete and checked; only the landing is pending.

## Land it

```bash
cd ~/MunHub                       # already cloned on Beacon
git fetch origin
git checkout -b fix/status-badge-tells-the-truth origin/v5-production
git apply ~/munhub-v5.5.0-status-pill.patch
node tools/check-status-rule.mjs  # expect 10/10 passed
git add public/css/main.css public/index.html public/js/config.js \
        public/js/data-manager.js public/js/ui-manager.js tools/check-status-rule.mjs
git commit -F ~/munhub-v5.5.0-status-pill.commitmsg
git push -u origin fix/status-badge-tells-the-truth
gh pr create --repo alexanderkholodov1/MunHub --base v5-production \
  --title "v5.5.0: the status pill stops calling a silent detector a backend failure"
```

`v5-production` is the branch Firebase Hosting deploys (`main` is 121 commits ahead and is not
what `munhub-lab.web.app` serves), so the fix targets `v5-production` deliberately.

## What was wrong

The red dot was read as *"the site cannot reach its backend"*. **It never meant that.** It meant
the newest reading in the selected profile was more than an hour old — precisely what happens when
the recording computer is switched off. Three defects in `public/js/data-manager.js`:

1. **Connection and freshness were the same dot.** On a phone the CSS hides the label, so colour
   was the whole message. Firebase already publishes the real answer at `.info/connected`; that now
   drives an honest `Offline`, and data age gets its own wording and a `title=` that says in words
   that the database connection is fine and the *detector* is quiet.
2. **The pill froze.** `_updateLiveStatus` ran only inside the `latest` value callback, so with no
   new data there was no callback and the badge kept whatever it last said — a dashboard left open
   while the detector died showed a green `LIVE` indefinitely, and one that had rendered `3h ago`
   stayed red even after data resumed. It is now derived from state on a one-second tick.
3. **No data at all looked healthier than stale data.** `if (_latestData) _updateLiveStatus(...)`
   skipped the update when `latest` was absent, leaving the green `Connected` the profile loader
   had just set. Absence is now a reported state (`No data`).

Data between two minutes and one hour old used to render as green `connected`; it is now amber
`stale`. The platform is working and the detector is quiet — neither success nor failure, and the
one state a two-colour pill could not express.

## What this does NOT fix — read this part

**This makes the dashboard tell the truth; it does not make the detector upload again.** If the
badge still reads `Nh ago` after deploying, the platform is fine and the recording machine is not
publishing. Check the actual data first — this session's harness blocked outbound calls to the
database, so nobody has verified it yet:

```bash
curl -s "https://munhub-1-default-rtdb.firebaseio.com/profiles.json?shallow=true"
curl -s "https://munhub-1-default-rtdb.firebaseio.com/profiles/<profileId>/latest.json"
```

The `latest.ts` value in that second response, compared against `date +%s`, is the entire story the
pill is reporting. If it is old, the fault is upstream of the website: `database.rules.json`
requires `auth != null` **and** owner/editor/admin on every write path, so the most likely cause
after a reboot is that the uploader's Firebase session was not restored and its writes are being
rejected — silently, from the dashboard's point of view. That is the next thing to investigate, and
it is a different fix from this one.
