#!/usr/bin/env python3
"""claude-usage-by-session.py: where the quota went, by session and by model.

Adds up the tokens of the transcripts of every session (and of its subagents) since an instant, and prints one line per
session and model family, sorted by estimated cost, plus the share of each model family.

Usage:   claude-usage-by-session.py [since-UTC]
           since-UTC  an ISO instant such as 2026-11-16T22:00:00 (compared as text with the first 19 characters of each
                      record's timestamp). Without it: $CLAUDE_USAGE_SINCE, then 2026-11-15T15:00:00
Reads:   <claude-home>/projects/*/*.jsonl                       the transcripts of the sessions
         <claude-home>/projects/*/<session>/subagents/*.jsonl   the transcripts of their subagents (counted for the parent)
         <claude-home>/sessions/*.json                          the live sessions, only to turn a session id into its name
Writes:  stdout only. Each line: "<share>%  <session name, 16 chars> <family> turns=<n> out=<M> cacheR=<M> cacheW=<M> in=<M>"
         (the 22 most expensive), then a dict with the share of each model family ({} when there is nothing since the
         instant). A session with no name shows the first 8 characters of its id
Env:     CLAUDE_CONFIG_DIR  the claude home (default: $HOME/.claude)
         CLAUDE_USAGE_SINCE the default instant
Exit:    0

The share is an ESTIMATE, not a number from Anthropic. The weights are assumptions: a model family counts fable 2.5 x
opus, sonnet 0.6, haiku 0.2; a token costs 5 (input), 25 (output), 0.5 (cache read, 0.1 x input) or 10 (cache write,
2 x input) units per million. A record counts once per (message id, request id), because a transcript repeats it.
"""
import collections
import glob
import json
import os
import sys

DEFAULT_SINCE = "2026-11-15T15:00:00"
WEIGHTS = {"fable": 2.5, "opus": 1.0, "sonnet": 0.6, "haiku": 0.2}
TOP = 22


def claude_home():
    """The claude home directory: $CLAUDE_CONFIG_DIR, or ~/.claude."""
    return os.environ.get("CLAUDE_CONFIG_DIR") or os.path.expanduser("~/.claude")


def session_names(home):
    """Maps session id -> name from the live session files (a file that cannot be read is skipped)."""
    names = {}
    for f in glob.glob(os.path.join(home, "sessions", "*.json")):
        try:
            d = json.load(open(f))
            sid = d.get("sessionId") or d.get("id")
            n = d.get("name") or d.get("title")
            if sid and n:
                names[sid] = n
        except Exception:
            pass
    return names


def family(model):
    """The model family of a model id (fable, opus, sonnet, haiku), or the id itself when it is none of them."""
    for fam in ("fable", "opus", "sonnet", "haiku"):
        if fam in model:
            return fam
    return model


def collect(home, since, names):
    """Adds up the usage records of every transcript since `since`.

    @returns a dict {(session name, family): Counter(in, out, cr, cw, n)}
    """
    agg = collections.defaultdict(collections.Counter)
    seen = set()
    projects = os.path.join(home, "projects")
    files = glob.glob(os.path.join(projects, "*", "*.jsonl")) + glob.glob(os.path.join(projects, "*", "*", "subagents", "*.jsonl"))
    for f in files:
        if not os.path.exists(f):
            continue
        # a subagent transcript belongs to the session whose folder holds it
        sid = os.path.basename(f)[:-6] if "/subagents/" not in f else f.split("/")[-3]
        try:
            for line in open(f, errors="ignore"):
                if '"usage"' not in line:
                    continue
                try:
                    d = json.loads(line)
                except Exception:
                    continue
                ts = d.get("timestamp", "")
                if ts[:19] < since:
                    continue
                m = d.get("message") or {}
                u = m.get("usage")
                mid = m.get("id")
                if not u or not mid:
                    continue
                key = (mid, d.get("requestId"))
                if key in seen:
                    continue
                seen.add(key)
                c = agg[(names.get(sid, sid[:8]), family(m.get("model", "?")))]
                c["in"] += u.get("input_tokens", 0)
                c["out"] += u.get("output_tokens", 0)
                c["cr"] += u.get("cache_read_input_tokens", 0)
                c["cw"] += u.get("cache_creation_input_tokens", 0)
                c["n"] += 1
        except Exception:
            pass
    return agg


def main():
    if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help"):
        print(__doc__.strip())
        return
    since = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("CLAUDE_USAGE_SINCE") or DEFAULT_SINCE
    home = claude_home()
    agg = collect(home, since, session_names(home))
    rows = []
    for (n, fam), c in agg.items():
        w = WEIGHTS.get(fam, 1)
        cost = w * (c["in"] * 5 + c["out"] * 25 + c["cr"] * 0.5 + c["cw"] * 10) / 1e6
        rows.append((cost, n, fam, c))
    # `or 1`: records that carry no tokens at all would divide by zero (the original crashed there)
    tot = sum(r[0] for r in rows) or 1
    for cost, n, fam, c in sorted(rows, reverse=True)[:TOP]:
        print(f"{cost/tot*100:5.1f}%  {n[:16]:16} {fam:6} turns={c['n']:5} out={c['out']/1e6:5.2f}M cacheR={c['cr']/1e6:7.1f}M cacheW={c['cw']/1e6:6.1f}M in={c['in']/1e6:5.2f}M")
    byfam = collections.Counter()
    for cost, n, fam, c in rows:
        byfam[fam] += cost
    print({k: f"{v/tot*100:.0f}%" for k, v in byfam.items()})


if __name__ == "__main__":
    main()
