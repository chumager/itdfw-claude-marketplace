# secret-scan — stop a secret before it leaves the machine

A bash wrapper around [gitleaks](https://github.com/gitleaks/gitleaks) (a pinned version) with a set of rules of its own,
and a second script, `push-develop.sh`, that pushes to `origin/develop` after every commit **only if the scan found
nothing that blocks**. The scanner is also a gate for anything else that is about to be published (a package tarball, a
folder of files): it takes a git range or a list of files and says, one line per finding, what is wrong and where, and
never prints the secret.

> **What it is not.** It is not a secret manager and it does not look at the history of a repository that was already
> pushed: it scans the diff of the commits you give it, or the files you name. A pattern that no rule knows is not
> found. gitleaks' own rules cover many providers; the rules in `secret-scan.toml` add the ones this project had trouble
> with (see "What it exposes").

Line numbers below are relative to this directory and were checked against the code on 2026-11-18.

## Files

| File | What it is |
|---|---|
| `secret-scan.sh` (127 lines) | the scanner |
| `secret-scan.toml` (85 lines) | the fixed rules, on top of gitleaks' defaults |
| `push-develop.sh` (114 lines) | the automatic push, with the scan before it |
| `_env.sh` (35 lines) | the optional config file both scripts read (a library, sourced) |
| `test/` | 38 cases, `node:test` |

`secret-scan.ignore` is **not** part of this piece: it is the list of false positives that **you** reviewed in **your**
repository, so it is yours. Its format is described below.

## What it exposes

### `secret-scan.sh`

```
secret-scan.sh [--strict] <git-range>        scans the diff of those commits (e.g. origin/develop..HEAD)
secret-scan.sh [--strict] --files <paths…>   scans those files as they are on disk
```

| Output / exit | Meaning |
|---|---|
| `BLOQUEA <file>:<line> <rule>` | a finding that blocks. **The two words `BLOQUEA` and `AVISA` are kept in Spanish on purpose**: they are the contract that `push-develop.sh` and publish gates match on |
| `AVISA <file>:<line> <rule>` | a finding of a "warn" rule (own hosts and paths); it only blocks with `--strict` |
| exit 0 | clean, or only warnings (an empty range is clean without calling gitleaks, `secret-scan.sh:109-111`) |
| exit 1 | something blocks |
| exit 2 | it could not scan: gitleaks missing, a bad range, not a git repository, a bad setting. The reason goes to stderr |

The rules of `secret-scan.toml` (ids are kept as they were, because the fingerprints in an ignore file contain them):

| Rule id | Blocks | What it matches |
|---|---|---|
| `itdfw-mongo-url-credenciales` | yes | a MongoDB URL with user and password |
| `itdfw-jwt`, `itdfw-sk-key`, `itdfw-facebook-token`, `itdfw-bearer` | yes | a JWT, an `sk-` API key, a Meta token (`EAA…`), a `Bearer` header with a token |
| `itdfw-env-default-secreto` | yes | `PASSWORD`/`SECRET`/`TOKEN`/`API_KEY`/`MONGO` read from the environment **with a literal default** (`X \|\| "value"`) |
| `itdfw-password-literal` | yes | `password = "…"` in code |
| `itdfw-api-token-uuid` | yes | the ITDFW API token (a 36-character UUID) assigned to `token`/`key`/`secret`, to `x-itd-access`, or passed as `--token` |
| `itdfw-archivo-mcp-json`, `itdfw-archivo-env`, `itdfw-archivo-llave` | yes | by **file name**: `.mcp.json`, `.env`/`.env.*`, `*.pem`/`*.pfx`/`*.key`/`id_rsa*` |
| `itdfw-host-propio` | warns | your own hosts, built from `SECRET_SCAN_OWN_HOSTS` (no rule when unset) |
| `itdfw-ruta-propia` | warns | paths of your machine, built from `SECRET_SCAN_OWN_PATHS` (default: `/home/<name>/` and `/Users/<name>/`) |

**`/etc/itdfw/` is not a private path.** It is where the product documents its deploy config, so a text that names it
(a README, a skill, a test) is not a leak. The default pattern does not match it, and the rule built from your own
pattern carries a rule-level allowlist for it (`secret-scan.sh:83`), so a broad `SECRET_SCAN_OWN_PATHS` such as `/etc/`
still leaves `/etc/itdfw/…` alone while `/etc/hosts` is reported (`test/secret-scan.test.mjs`). The allowlist is per
**line**: a line that names `/etc/itdfw/` and also a private path is not reported by that rule.

A line that holds a made-up fixture is marked `// scan-ok` or `# scan-ok` and is skipped by every rule.

### Settings

Each one is an environment variable and can also be a line `KEY=value` in
`${XDG_CONFIG_HOME:-$HOME/.config}/secret-scan/env` (`SECRET_SCAN_ENV` for another path), which is how a git hook
gets them: a hook runs with a minimal environment. The environment wins over the file; the file is read, never executed.

| Variable | Default | Meaning |
|---|---|---|
| `SECRET_SCAN_OWN_HOSTS` | none | a regex (Go/RE2 syntax) for your hostnames |
| `SECRET_SCAN_OWN_PATHS` | `/home/<name>/`, `/Users/<name>/` | a regex for paths of your machine; set to empty to switch the rule off |
| `SECRET_SCAN_ALLOW_PATHS` | none | a regex for files left out of the scan entirely, for third-party build output that matches a token rule by chance and changes its hash at every build |
| `SECRET_SCAN_IGNORE` | `secret-scan.ignore` next to the script | the fingerprint file of reviewed false positives: one fingerprint per line, `#` comments, the `.gitleaksignore` format (`<commit>:<file>:<rule>:<line>` for a range, `<file>:<rule>:<line>` for `--files`) |
| `SECRET_SCAN_GITLEAKS` | `gitleaks` from the `PATH`, then `~/.local/bin/gitleaks` | the binary to use; if set and not executable the script stops (exit 2) and installs nothing |
| `SECRET_SCAN_NO_INSTALL` | unset | `1` = never try to install gitleaks |

A value with three single quotes in a row is refused (exit 2): it would end the TOML string the regex is written in.

### `push-develop.sh`

Installed as (or called from) the repository's `.git/hooks/post-commit`. It needs no arguments.

| Part | What it does |
|---|---|
| synchronous (end of the commit) | only on the branch `develop`; prints the failures still pending from earlier commits; scans `origin/develop..HEAD`; with something that blocks it prints the findings (file, line, rule, never the secret) and does **not** push; otherwise it starts the background part and prints `↑ push to origin/develop in the background` |
| background (`setsid`) | under `flock` (waits up to 5 minutes), pushes the scanned commit. If the remote moved ahead, and only with a clean tree, HEAD still on `develop` and no conflict predicted by `git merge-tree --write-tree`, it runs `git pull --rebase`, scans again what the rebase rewrote, and pushes. In any other case it touches nothing and writes a pending line saying how to resolve it by hand |

It always exits 0: a failure must never fail the commit. State lives in `$PUSH_DEVELOP_CACHE` (default
`~/.cache/push-develop/`): `last.log`, `last-scan.txt`, and `pending` (cleared at the next successful push; printed on
every commit until then). Settings: `SECRET_SCAN` (the scanner to call, default the one next to it),
`PUSH_DEVELOP_REMOTE` (`origin`), `PUSH_DEVELOP_BRANCH` (`develop`), `PUSH_DEVELOP_CACHE`.

## How it works

1. `secret-scan.sh` builds a **temporary config** for the run: it copies `secret-scan.toml`, then appends the host rule
   and the path rule from the settings above and an `[allowlist]` (the `scan-ok` marker plus
   `SECRET_SCAN_ALLOW_PATHS`) (`secret-scan.sh:70-87`). The file gets a `.toml` suffix because gitleaks 8.16 takes the
   format from the suffix and, without it, silently runs on its defaults alone (found while testing, `:67-68`).
2. It runs `gitleaks detect --redact -f json` over the range (`--log-opts`) or, for each file, with `--no-git`
   (`:89-93`, `:95-113`). `--redact` keeps the secret out of the report.
3. It drops the findings whose fingerprint is in the ignore file (`:115-120`), prints one `BLOQUEA`/`AVISA` line per
   finding, deduplicated and sorted with the blockers first, and exits 1 if any finding blocks (every finding with
   `--strict`, the non-"warn" ones otherwise) (`:122-127`).
4. If gitleaks is missing and nothing forbids it, it tries `sudo -n apt-get install -y gitleaks` and, if that fails, the
   release `8.16.0` for Linux x64 from GitHub, checked against a sha256 written in the script, into `~/.local/bin`
   (`:46-54`, called from `:55-65`).

`push-develop.sh` is the loop above plus `git`; its rebase rules are in the table of the previous section.

## How to verify it

```sh
cd agent-tools/secret-scan
pnpm test      # node --test "test/*.test.mjs"
```

38 cases, no network and no real `~/`: each one builds a temporary root with a fake `HOME` and, for `push-develop.sh`,
a real git repository with a bare `origin` next to it. They need `gitleaks` on the `PATH` (the cases that run the real
scanner are skipped without it, and say so); the machine that wrote this piece had Debian's `gitleaks 8.16.0`.

| Property | How it is attacked | What would fail it |
|---|---|---|
| a file with a made-up key blocks, and the key is never printed | `--files` on a file with `sk-…`: expects `BLOQUEA <file>:1 itdfw-sk-key`, exit 1, and the key absent from stdout and stderr | a missing rule, or a report that leaks the match |
| a clean file passes | `--files` on a file with nothing: empty output, exit 0 | a rule that matches ordinary code |
| each fixed rule fires | one file per rule (Mongo URL, JWT, Bearer, literal password, ITDFW token) and one per blocked file name | a regex typo |
| `scan-ok` skips only its own line | two lines with the same key, one marked | a marker that skips the whole file |
| `/etc/itdfw/x.yaml` no longer blocks in strict | `--strict --files` on it: exit 0, empty output; and with a broad own-paths pattern, `/etc/hosts` still blocks | the old rule, which flagged it |
| own hosts and paths are configurable | env and config file; the environment wins; empty switches the rule off | a rule that stays on, or a setting that is ignored |
| a range is scanned by file and line | a temporary repository with a clean and a leaking commit | a wrong line number, or an empty range that calls gitleaks |
| `push-develop.sh` pushes only what is clean | a clean commit reaches the bare `origin`; a leaking one does not, prints the finding, and is listed as pending on the next commit | a push that goes out despite the scan |
| a moved-ahead remote | another clone pushes first: the commit is rebased, scanned again and pushed; with a conflicting change it is left untouched | a rebase over a dirty tree, or a lost commit |

**What this does not cover.** The apt/curl installer is exercised only with stubs that log and fail (it proves the order
of the attempts, not that the release downloads and verifies). Nothing was run against a large history. Whether gitleaks
8.16 finds every secret of every provider is gitleaks' business and was not measured.

## What depends on ITDFW

Almost nothing in the code: it needs `bash`, `jq`, `git`, `flock`, `setsid` and `gitleaks`. What is ITDFW's is in the
**rules**: the ITDFW API token shape (`itdfw-api-token-uuid`), the `x-itd-access` header, the `.mcp.json` file name
and the `/etc/itdfw/` exception. A project of another stack can delete those from `secret-scan.toml` and keep the rest.
The rule ids keep their ITDFW-era names (some in Spanish) so that the fingerprints of an existing ignore file still match.

## Limits

- **Linux and bash only.** The installer fetches the Linux x64 build; `mktemp --suffix`, `readlink -f`, `flock` and
  `setsid` are GNU/Linux tools.
- **gitleaks is pinned to 8.16.0** for the installer, but the script uses whatever `gitleaks` it finds first. The
  `.toml` suffix workaround (above) and the rule-level allowlist were checked on 8.16.0 only.
- The installer runs `sudo -n apt-get install` by itself when gitleaks is absent. On a machine where that is not wanted,
  set `SECRET_SCAN_NO_INSTALL=1`.
- **A reviewed false positive is a fingerprint, and a fingerprint in a range contains the commit hash**; a rebase
  rewrites the hash, so the fingerprint stops matching (deduced from the format, not measured). For a file that keeps
  false positives, `scan-ok` on the line is steadier.
- The `/etc/itdfw/` exception is per line (see above).
- `BLOQUEA`/`AVISA` are Spanish words kept as a machine-readable contract; everything else is in English.
- `push-develop.sh` pushes to a fixed remote and branch (settable by variable), force-pushes nothing, and treats any
  failure as "pending" instead of failing the commit: a person who never looks at the commit output never sees the
  failure. It does not wire itself into the repository: the `post-commit` hook is yours to install.
- The scan of a range covers what the commits added or changed; a secret that already sits in the history of a branch
  before the range is not looked at.
