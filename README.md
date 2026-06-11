# deals.dev for Codex

**Earn while Codex works.** This hook plugs into Codex's `notify` mechanism:
when an agent turn finishes, one sponsored line appears as a quiet desktop
notification — and **70% of what the advertiser paid is credited to your
deals.dev balance**.

Zero dependencies. One auditable script. Nothing touches your code or
prompts.

## What is deals.dev?

[deals.dev](https://deals.dev) is a marketplace for coding-agent idle time:

- **Advertisers** bid for the sponsored slot in a live auction. One *block*
  buys 1,000 five-second impressions; the highest bid serves first.
- **Developers** (you) run a small client like this one. Every confirmed
  impression credits **70% of the bid** to your account.
- **Clicks pay 50×** an impression — open a sponsor through its tracked
  link and the multiplier lands in your balance too.
- **Cash out from $25** — instantly via Stripe Connect, or manually
  (PayPal/Venmo/Wise/ACH) from your [dashboard](https://deals.dev/dashboard).

Every impression, click, and cent is visible in an auditable ledger at
[deals.dev/dashboard](https://deals.dev/dashboard).

## Install

1. Create a free account at [deals.dev](https://deals.dev) and generate a
   device API key (`dd_live_...`) in the
   [dashboard](https://deals.dev/dashboard).
2. Clone this repo and run the installer:

```bash
./install.sh dd_live_yourkey
```

The installer writes your key to `~/.deals-dev/config.json` and appends the
hook to `~/.codex/config.toml`. That's it.

## Manual setup

Add to `~/.codex/config.toml`:

```toml
notify = ["node", "/path/to/this/repo/notify.js"]
```

Provide your key either in `~/.deals-dev/config.json`:

```json
{ "apiKey": "dd_live_yourkey" }
```

…or as an environment variable:

```bash
export DEALS_DEV_API_KEY=dd_live_yourkey
```

Optional: point at a different API host with `DEALS_DEV_API_URL` or
`"apiUrl"` in the config file.

## How it works

1. Codex calls `notify.js` on agent lifecycle events (turn complete,
   approval requests) with a small JSON payload describing the event type —
   the script reads only the event type, nothing else.
2. On each event the script confirms the previously shown impression via
   `POST https://deals.dev/api/v1/events` — confirmation is what credits
   your balance; amounts are computed server-side only.
3. It then fetches the current top-bidding ad from `GET /api/v1/ad` and
   surfaces it as a desktop notification (macOS via `osascript`, Linux via
   `notify-send`). On other platforms the earning still happens, just
   silently.

Offline or no campaigns live? Nothing breaks — unconfirmed impressions
queue in `~/.deals-dev/codex-cache.json` and retry on the next event.

## Privacy

The script sends exactly three things to deals.dev: your API key (to credit
the right account), your OS platform (used only for advertiser OS
targeting), and impression confirmations. **No code, no prompts, no file
paths, no transcript contents — ever.** It's one short file; read it
yourself.

## Fair-play rules

- Impressions are rate-limited server-side to human-plausible speeds.
- An impression only pays after it's confirmed on a later event.
- One click per impression, within 10 minutes of a confirmed view.
- Scripted farming earns nothing and gets the API key revoked.

## Uninstall

Remove the `notify` line from `~/.codex/config.toml` and delete
`~/.deals-dev`.

## License

MIT
