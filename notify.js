#!/usr/bin/env node
/**
 * deals.dev notify hook for Codex.
 *
 * Codex calls this script on agent lifecycle events (configured via `notify`
 * in ~/.codex/config.toml) and passes a JSON payload as the last argument.
 *
 * On "agent-turn-start" (or any begin-like event) we fetch the current top
 * ad and surface it as a desktop notification; on turn end we confirm the
 * impression so 70% of the bid is credited to your deals.dev balance.
 *
 * Configure via ~/.deals-dev/config.json (written by install.sh) or the
 * DEALS_DEV_API_KEY environment variable. Zero dependencies.
 */

const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");

const CONFIG_DIR = path.join(os.homedir(), ".deals-dev");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const CACHE_FILE = path.join(CONFIG_DIR, "codex-cache.json");
const FETCH_TIMEOUT_MS = 2_000;

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
}

function getConfig() {
  const cfg = readJson(CONFIG_FILE, {});
  return {
    apiKey: process.env.DEALS_DEV_API_KEY || cfg.apiKey || "",
    apiUrl: (process.env.DEALS_DEV_API_URL || cfg.apiUrl || "https://deals.dev").replace(/\/$/, ""),
  };
}

/** Strip control chars from advertiser text before it reaches the notifier. */
function sanitizeText(s) {
  // eslint-disable-next-line no-control-regex
  return String(s == null ? "" : s).replace(/[\x00-\x1f\x7f-\x9f]/g, "");
}

function desktopNotify(title, body) {
  if (process.platform === "darwin") {
    execFile("osascript", [
      "-e",
      `display notification ${JSON.stringify(body)} with title ${JSON.stringify(title)}`,
    ], () => {});
  } else if (process.platform === "linux") {
    execFile("notify-send", [title, body], () => {});
  }
}

async function confirmPending(cache, cfg) {
  const pending = cache.pendingConfirms || [];
  if (pending.length === 0) return cache;
  try {
    await fetch(`${cfg.apiUrl}/api/v1/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        events: pending.slice(0, 50).map((impressionId) => ({
          type: "impression",
          impressionId,
        })),
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    cache.pendingConfirms = pending.slice(50);
  } catch {}
  return cache;
}

async function main() {
  const cfg = getConfig();
  if (!cfg.apiKey) return;

  let payload = {};
  try {
    payload = JSON.parse(process.argv[process.argv.length - 1]);
  } catch {}
  const eventType = String(payload.type || payload.event || "");

  let cache = readJson(CACHE_FILE, {});

  // Any previously shown ad has had its display window — queue confirmation.
  if (cache.ad) {
    cache.pendingConfirms = [...(cache.pendingConfirms || []), cache.ad.impressionId];
    cache.ad = null;
  }
  cache = await confirmPending(cache, cfg);

  // On turn completion, surface the next sponsor while the user reviews.
  if (/turn|complete|approval/i.test(eventType) || eventType === "") {
    try {
      const res = await fetch(`${cfg.apiUrl}/api/v1/ad`, {
        headers: {
          Authorization: `Bearer ${cfg.apiKey}`,
          "X-Deals-OS": process.platform,
        },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ad) {
          cache.ad = data.ad;
          cache.fetchedAt = Date.now();
          const brand = sanitizeText(data.ad.brandName);
          const line = sanitizeText(data.ad.adLine);
          const label = brand ? `${brand} — ${line}` : line;
          desktopNotify("Codex done · sponsored by", label);
        }
      }
    } catch {}
  }

  writeJson(CACHE_FILE, cache);
}

main().then(() => process.exit(0), () => process.exit(0));
