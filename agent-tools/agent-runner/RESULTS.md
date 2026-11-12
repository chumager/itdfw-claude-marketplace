# agent-runner: results

What was measured with this proof of concept, between 2026-11-09 and 2026-11-11: the Claude Agent SDK behind an HTTP
service, and one job run through it (building a menu from photos) with three models and five prompt versions.

> ## Read this first: what these numbers measure
>
> **The reference every result is compared with is another model's transcription of the same photos. Nobody validated it
> against the photos.** So the numbers below measure **agreement between two readings** (the agent's and the reference's), not
> correctness against what is printed. Wherever a difference between the two was looked at in the photo, the text says so
> ("seen in the photo"); everything else that agrees with the reference is **deduced** to be right, not checked. The reference
> turned out to differ from the printed text in places (see the defect table), so a disagreement is not always the agent's error,
> and an agreement is not proof of a correct reading.
>
> The job was one printed menu of 99 items on two photos, 3 runs per configuration. That is a signal, not a frequency.

The real menu and its photos are not published. The repository ships an invented menu (`fixtures/`) instead; the numbers below
were **not** measured on it.

## Setup

| | |
|---|---|
| SDK | `@anthropic-ai/claude-agent-sdk` 0.3.321 (CLI 2.1.321), Node 26, Linux, no container |
| Models | `claude-haiku-5-5`, `claude-sonnet-5-5`, `claude-opus-5-5` |
| Mode | `inline` (the live service calls `query()`), except where `spawn` is named |
| Job | two photos of a printed menu (a food page and a drinks page, 1280x904 JPEG), 2 menus, 21 sections, 99 items, many with two printed prices |
| Reference | a JSON written by another model from the same photos, not validated (see above) |
| Cost | the SDK's `total_cost_usd`: a client-side estimate, not an invoice |
| Validator | `validate.mjs`: job finished, valid shape, no denied tool call, at least 90 % of the reference sections found by normalized name, product count within 10 %, no price inside a description, labelled variants kept. Comparator: `compare-menu.mjs` |

## 1. The service (plumbing), measured with a website-reading recipe

Measured first (2026-11-09, 25 runs, Haiku) with a recipe that read a public website. That recipe is not in this repository, but
the service numbers do not depend on it.

- **The job enters by one HTTP call.** `POST /jobs` answered `202 registered` in about 4 ms in all measured runs; the state, the
  timings, the cost and the file list come from `GET /jobs/:id`. (The state names were Spanish when measured; they are English here.)
- **It returns something.** The worker writes `out/done.json` to a temporary file and renames it; `fs.watch` detected it 0 to 1 ms after the worker
  ended in every run, and the callback arrived 1 to 10 ms after that with `{id, status, files}`.
- **The queue works.** 7 jobs of 2 s with `MAX_PROCS=3` ran in three batches (3, 3, 1), never more than 3 at once.
- **Up and down time.**

| | `inline` | `spawn` |
|---|---|---|
| service start until `/health` | 135 to 138 ms | 54 to 74 ms |
| SIGTERM until exit | 310 ms | 308 ms |
| idle RSS of the service | 91 MB (it loads the SDK at boot) | 63 MB |
| POST until the first SDK message (mean) | 1.09 s | 1.36 s |
| start of the job process (`spawn` until `bootAt`) | n/a | 16 to 26 ms |

The first SDK message takes about 1 s in both modes: it is the `claude` binary starting. `spawn` adds about 0.25 s for the SDK import in every worker.

- **Per job (website recipe, Haiku):** 100 to 185 s, about 0.03 USD, 330 to 470 MB of RSS in total (the `claude` binary is about 230 MB of it), mean CPU about 3 % of
  one core: the work is waiting for the model. RSS is the sum over the process tree sampled from `/proc` every 0.5 to 1 s; CPU is the difference of `utime+stime+cutime+cstime`.
- **Photo recipe, same service:** 3 runs of the v1 prompt on the real menu: 320 to 325 MB peak RSS, 4.6 to 5.1 % of one core, 46 s.

## 2. What the SDK did versus its documentation

- A path rule for writing is declared `Edit(path)`; `Write(path)` matches no call (the documentation says so). Checked with `probe-permissions.mjs`: with `Read(//dir/**)` and
  `Edit(//dir/out/**)`, reading a file outside the folder, writing outside it and writing inside the folder but outside `out/` were denied; a relative and an absolute path inside `out/` passed. Relative paths resolve against `cwd`.
- In `dontAsk` mode, `Bash` with a read-only command and `Glob` ran even though they were not in `allowedTools` (the documentation says that what needs no permission just runs). So the recipes remove them with `tools` **and** `disallowedTools`, not with `allowedTools` alone.
- The native binary dependency (about 340 MB) installs as an optional dependency and **the SDK uses it without `pathToClaudeCodeExecutable`**: seen through `/proc/<pid>/exe` of the child process during a real query.
- Reading a `.png` or `.jpg` with `Read` works as documented: the result carries no text (`chars: 0` in the log) and the agent still returned the right items, so it saw the image.

## 3. The photo recipe, prompt v1

The recipe has `tools: ["Read", "Write"]`, no `Bash`, `Glob`, `Grep`, `WebFetch` or `WebSearch`, 40 turns, a 0.6 USD cap, 6 minutes. The service validates the folder and
copies the photos into the job before queueing it (`src/server.mjs`); the agent cannot list the folder, so the user message carries the ordered list.

### 3.1 First, an invented menu

One invented printed menu (2 sections, 8 items, one item with two portions, **one deliberate printed misprint**), rendered to PNG, 1 photo and the same menu split in 2 photos, 3 runs each, Haiku, v1.

| | 1 photo | 2 photos |
|---|---|---|
| validator verdict | 3/3 ok | 3/3 ok |
| sections 2/2, items 8/8, variants 1/1, prices without difference | 3/3 | 3/3 |
| denied tool calls, prices inside descriptions | 0, 0 | 0, 0 |
| names equal to the reference | 7/8 in all 3 | 7/8 in all 3 |
| cost per run | 0.0014 to 0.0016 USD | 0.0015 to 0.0016 USD |
| turns, time from POST to `done.json` | 4, 8.2 to 9.7 s | 5, 8.3 to 8.8 s |

**What failed and the verdict did not see:** the agent **corrected the printed misprint in all 6 runs** and said in `report.md` that there were no misprints, the opposite of what the prompt asks.
The verdict does not include the share of names found (`nameMatchRate`, 7/8 here), so it stayed green. An attempt to fix it by prompt (read letter by letter, list every word that looks misspelled; one change, 3 runs) kept
the correction in 3/3, did not list it in `report.md`, and one run wrote an invalid `menu.json`; it was reverted. Deduced, not measured: Haiku normalizes while reading or writing.

### 3.2 The real menu, Haiku v1, 3 runs (2026-11-11)

| | run 1 | run 2 | run 3 |
|---|---|---|---|
| verdict | ok | **fail** (variants 9/10) | ok |
| sections found (9 of 9 and 12 of 12) | yes | yes | yes |
| sections that match by name | 19/21 = 0.905 | 19/21 = 0.905 | 19/21 = 0.905 |
| items | 99 | 101 | 99 |
| `nameMatchRate` | 1.000 | 0.990 | 1.000 |
| variants kept | 10/10 | 9/10 | 10/10 |
| denied calls, prices in descriptions, API errors | 0, 0, 0 | 0, 0, 0 | 0, 0, 0 |
| cost, turns | 0.00922 USD, 5 | 0.00950 USD, 5 | 0.00915 USD, 5 |
| output tokens | 13,414 | 13,864 | 13,310 |
| POST to `done.json` | 46.1 s | 47.5 s | 45.8 s |
| peak RSS (service + children) | 324.9 MB | 320.1 MB | 324.2 MB |
| CPU | 2.17 s, 4.7 % | 2.18 s, 4.6 % | 2.33 s, 5.1 % |

2 of 3 pass. The 0.905 against a 0.9 threshold is a margin of one section: two sections have a **note printed next to the title** (a count of pieces in parentheses) that the agent left out
of the name (its `report.md` says the note does not fit the JSON), and the others differ from the reference only in letter case (printed in capitals).
Run 2 failed for one reason: a dish with **three portions listed under one header line** came out as three dishes with one price each, a different reading of the same photo.

**Prices.** In all three runs, **no price value differed from the reference** for any paired item (the three portion-dishes of run 2 exist as separate items with the same three numbers). What differs is the text of the labels
(capitals as printed, versus the reference's capitalization; one "per person" label dropped in run 2).

### 3.3 Defect types found

Every difference in text between the output and the reference was compared with the photo (enlarged four times); the rest of the 99 names and the other descriptions are **deduced** to match the print because they match the reference.
Counted per word and per run, v1 on the real menu:

| Type of defect | Where it comes from | v1 count |
|---|---|---|
| **a misspelled dish word**: a printed spelling variant of a word was replaced by the variant used elsewhere | the model reading text that looks alike | 3 occurrences in 2 runs |
| **an ingredient swapped**: the end of a description replaced by the end of the neighboring dish's description | the same, across neighboring lines | 3 of 3 runs wrong (changes what the dish is) |
| **an accent mark added that is not printed** (judged from the enlarged photo; see the caveat below) | the model "fixing" the word | 6 occurrences |
| **a dish name split in two (or three)** | structure: one dish with three portions, or three dishes | 1 of 3 runs |
| **a section note lost** (a parenthesized count next to a title) | the format has no place for it | 3 of 3 runs |
| **a price misread** | never by the agent in any model or prompt; only by the OCR (digits dropped) | 0 |
| **a printed misprint corrected** | normalizing while reading | 0 in the real menu names; 6 of 6 runs on the invented menu |
| **the reference differs from the print** (an accent it lacks, a spelling it changes) | the reference, not the agent | 5 word occurrences |

**Caveat on accent marks.** The accent on one recurring word is about 2 px tall at this resolution. The first look at the enlarged photo (v1 analysis) read it as printed without the accent, which made the agent's accent an "addition";
later crops (during the v3 and v4 analysis) showed it printed with the accent. The two readings of the same photo disagree, so the "6 added accent marks" of v1 may be partly wrong, and in the later versions "writes the word without the accent" is judged against the later crops.
That ambiguity is a finding in itself: at this size the accent is hard for any reader, human, OCR or model.

Of the 17 word-level differences found in v1, 6 were wrong reads, 6 were added accent marks, and 5 were the agent copying what is printed where the reference differs.
Besides words, three non-word things change what is printed: the section notes, the label capitalization in one run, and one label dropped.
Seen in the photo: the agent copied the printed misprints of the item names (4 cases) exactly, none corrected. Its `report.md` lists "possible misprints copied as printed" in long lists that mix real ones with false positives, and
in one run it called a word a printed misprint when the photo prints the other spelling.

## 4. Haiku, Sonnet and Opus (the same v1 prompt, 3 runs each)

The Sonnet and Opus recipes are the same object as v1 with another `model`; only Opus also raises the spend cap to 1 USD so that 0.6 does not cut a run. Spend of the Sonnet batch 0.43 USD, of the Opus batch 0.77 USD.

| | Haiku | Sonnet | Opus |
|---|---|---|---|
| cost per run (USD) | 0.0092 / 0.0095 / 0.0092 | 0.1149 / 0.1130 / 0.2045 | 0.2553 / 0.2534 / 0.2643 |
| mean cost; times Haiku; per item | 0.0093; 1; 0.00009 | 0.144; 15.5; 0.00146 | **0.258; 27.7; 0.0026** |
| POST to `done.json` | 46.1 / 47.5 / 45.8 s | 41.7 / 42.6 / 76.2 s | 65.1 / 65.8 / 69.8 s |
| turns; `Write` calls | 5; 2 | 5; 2 (one run 7; 4) | 5; 2 in all three |
| output tokens; reasoning | about 13,400; about 5,600 | 7,900 to 15,200; about 650 | 8,939 / 9,110 / 9,448; about 1,000 to 1,300 |
| validator verdict | ok, fail, ok | fail, fail, fail | **ok, ok, ok** |
| price values different from the reference | 0 | 0 | 0 |
| `nameMatchRate`; variants kept | 1.000 / 0.990 / 1.000; 10, 9, 10 | 0.980 x3; 8 x3 | **1.000 x3; 10 x3** |
| the swapped ingredient comes out right | 0 of 3 | 3 of 3 | 3 of 3 |
| a dish split into three | 1 of 3 | 3 of 3 | 0 of 3 |
| a printed misprint in a name corrected | 0 of 3 | 3 of 3 | 0 of 3 |
| misspelled words (wrong reads) | 6 occurrences | 0 | 0 |
| accent marks added that are not printed | 6 occurrences | 3 | 0 |
| descriptions that differ from the reference | 5, 6, 4 | 2, 2, 2 | 1, 1, 1 |
| items | 99, 101, 99 | 101 x3 | 99 x3 |
| sections that match by name | 19/21 | 19/21 | 19/21 |

- **Seen:** Opus passes the verdict in 3 of 3 and has none of the three main defects (swapped ingredient, split dish, corrected misprint); its 99 names are identical to the reference, the printed misprint included, and its `report.md` lists
  the misprint as copied as printed. Its one description difference is the reference's own accent (the agent copied what is printed).
- **Seen:** Sonnet reads better (no misspelled word, no swapped ingredient) and **normalizes more**: it corrected a printed misprint in a name without saying so, and split the multi-portion dish the same way in 3 of 3. The corrected name left that item unpaired,
  which the validator counted as a broken variant: that and the split dish are what failed its verdict. No price was involved.
- **Seen:** one Sonnet run wrote `menu.json` twice (7 turns, 0.2045 USD, twice the output tokens). Why it rewrote could not be seen. Each Sonnet run also carries about 0.0002 USD of an internal Haiku call of the SDK, already in the total.
- **Deduced:** neither Haiku nor Sonnet keeps "transcribe exactly" stable; Opus did in these 3 runs. The three runs of Opus cost within 2 % of each other; Sonnet varied by a factor of two.
- **Cost:** 0.258 USD for a 99-item, 2-photo menu is 26 % of a 1 USD ceiling. Linear extrapolation (not measured; output grows with items and input with photos) puts 1 USD at about 380 items.

## 5. Prompt versions v1 to v5 (Haiku, same photos, 3 runs each)

All five are the same job and the same model; only the system prompt (and, for v3 to v5, the OCR aids) changes. The earlier version stays as the control of the next one.

| Version | What changes | Cost per run | Time | Verdict | Swapped ingredient right | Misspelled-word occurrences |
|---|---|---|---|---|---|---|
| **v1** | the base prompt | 0.0093 USD | 46 s | ok, fail, ok | 0 of 3 | 3 |
| **v2** | a reading guide (text weight, columns, notes next to titles, multi-portion dishes) and, per dish, `source` (printed text before splitting it) and `doubt` | 0.0128 USD (1.4x) | 57 to 63 s | ok x3 | 2 of 3 | 9 (+1 other word) |
| **v3** | v2 + OCR text next to each photo + `WebSearch` for an unknown word | 0.0172 USD (1.9x) | 79 to 89 s | ok x3 | 3 of 3 | 0 |
| **v4** | v3 with the OCR demoted to an alarm and a rule never to copy from it | 0.0160 USD | 77 to 85 s | ok x3 | 3 of 3 | 0 |
| **v5** | v4 with two OCR readings (own size and enlarged), the agent judges how far to trust them per photo | 0.0178 USD (1.9x) | 84 to 100 s | ok x3 | 3 of 3 | 0 |

**v2 (structure).** Fixes structure: the split dish 0 of 3 (v1: 1 of 3), the section notes kept in `note` 3 of 3 (v1: lost 3 of 3), verdict 3 of 3, the swapped ingredient right in 2 of 3. In the
split-dish case the photo prints a header line with a sentence under it and then three portions; v2 stored the sentence as the section's note and said so in `doubt`, a defensible reading that differs from the reference.
It does not fix wrong reads: the spelling variant of one word printed in one dish spread to other dishes in two runs (3 occurrences in v1, 9 in v2; with 3 runs that may be variation, but it did not go down), and the swapped ingredient came back once with an empty `doubt`.
The doubts it writes are true and useful (copied misprints, a small-digit price, a price and its label glued together), but **none of the real errors carried a doubt**: the field collects what the agent already noticed, not what it believes it read and did not.

**v3 (OCR and search).** The wrong reads by association drop to zero in all 3 runs. A new kind of error appears: the OCR read an accented letter as another letter, and Haiku copied that wrong word into **8 descriptions** (2 + 3 + 3);
in 2 the `doubt` was empty and in 6 the `doubt` claimed "this is printed that way", **asserting about the photo something the photo does not say**: worse than silence, because a reviewer who trusts the note does not look.
Also seen: the OCR is not a reliable reader of this menu either (it dropped digits of prices, a four-digit price read with three; swapped degree signs for `*` and `%`; deformed two rare words), but the agent resolved those against the photo and wrote them down, and
the 21 to 32 doubts per run are the most useful the field has given: they say when the second reader disagreed and what was chosen. `WebSearch` was **never used** (0 calls in 3 runs): no word was unknown to it, so the search is not measured.

**The OCR is limited by text size, not photo quality** (measured without a model, this menu, tesseract; exact prices are the numeric tokens of the OCR against the 110 reference prices):

| enlargement before the OCR | exact prices |
|---|---|
| none | 104 of 110 |
| 2x | **110 of 110** |
| 3x | 106 of 110 |
| 4x | 103 of 110 |

At 1280 px wide the monospaced text is about 10 px tall and the OCR drops repeated digits. But a fixed enlargement is **not universal**: on another menu photo (portrait, dark background, red prices, 25 prices) the OCR got 2 of 25 prices
at 100 %, 147 % and 200 % and 4 of 25 at 300 %; what fails there is contrast, not size. Enlarged OCR also loses accent marks.

**v4 (alarm).** Fixes what was asked: the OCR-induced wrong word 8 to 0, and the by-association errors stay at 0. But it **regresses on accent marks**: in all 3 runs the word whose accent is printed was written without it in all 8 occurrences,
and two more words lost their accents (one of them in 2 of 3 runs); the 2x OCR also reads them without, and the agent aligned with it although the prompt says not to copy. Inconclusive (v2 without OCR also dropped it in one run), but with 3 runs it looks like
an influence of the OCR on what is hard to see (an accent mark 2 px tall). Deduced: this resolution does not support that accent for any reader.

**v5 (the agent decides).** The service measures the median height of the words the OCR recognizes and, if the text is small, enlarges to about 22 px (at most 2.5x), leaving **two** readings (`.ocr.txt` and `.ocr-scaled.txt`); neither is declared better.
The prompt asks the agent to look at the photo first, judge how far the OCR can help on that photo, and write one line in `report.md` on how reliable it looked and how it failed.
Result: the two accent marks v4 lost come back (3 of 3 runs), the OCR-copied errors and the by-association errors stay at 0, no denied calls, no API errors. What remains: the word with the 2 px accent is still written without it in all 8 occurrences of all 3 runs, and
the agent flagged the doubt in only 1 of the 8. Seen: with no guidance beyond the prompt, the agent wrote a correct and specific assessment of the OCR ("dropped digits in some prices, lost accents, misread symbols; good on the Spanish words of the first photo, noisier on the second"),
which is what is needed to decide how far to trust the OCR on each menu and to warn a customer about the quality of their photo.

| | v3 | v4 | v5 |
|---|---|---|---|
| the 2 px accent kept (of 24 occurrences) | 3 | 0 | 0 |
| the two other accent marks kept | yes | no in 2 of 3 runs | **yes in 3 of 3** |
| dishes with a `doubt` (of 99) per run | 21, 27, 32 | 27, 12, 25 | 11, 16, 27 |
| `Read` calls per run | 4 | 4 | 6 |
| CPU of the service | 11 to 13 % of a core | 20 to 22 % | 26 to 31 % |
| output tokens (reasoning) | 23,000 to 26,000 (9,900 to 12,500) | 21,700 to 23,600 (8,500 to 10,200) | 22,076 to 27,061 (8,535 to 14,000) |

Spend per prompt-version batch: v2 0.04 USD, v3 0.05, v4 0.05. Not measured: another menu with another design (landscape, glare, rotation), a 20-photo menu, a text inside an image that asks the agent to do something (the prompt declares image text to be data; it was not attacked).

## 6. Use condition

Against the property that matters for a menu, extracting it as printed: **prices and item names are usable** (no run of any model returned a price value different from the reference; the runs that returned 99 items matched 99 of 99). **Descriptions are not usable without a human review:** an ingredient swapped for the neighbor's changes the dish and came out 3 of 3 with v1.
Any real use needs the owner's review before publishing. It is a condition of use, not a defect waiting for a fix. And remember the header: this is agreement with a reference nobody validated; only the differences were opened in the photo. The 99 prices were not checked by hand against the image.

## 7. If this became a product

- **The first change:** the verdict measures appearance, not the property. It passes 0.905 sections against a 0.9 threshold while the agent corrects misprints against the prompt's rule (6 of 6 on the invented menu), because it lacks `nameMatchRate`. Add it to the conditions of `ok`.
- **Score text apart from structure.** `ok` should measure name, price (with its label) and structure, not descriptions. Descriptions get a second measure, "faithful", reviewed against the photo, because an added accent mark and a changed ingredient do not weigh the same;
  a changed ingredient is reported on its own, and on a menu with allergens it is not a detail. A parenthesized note in a section title is a note, not part of the name, and should be compared without it. A reviewer's independent cross-check of names and labelled prices agreed with this validator's.
- What would keep it a proof of concept before offering it as an automatic migration: the swapped ingredient in 3 of 3 (v1) and the split dish in 1 of 3; both would be attacked with the prompt, which was done in v2 to v5 for most of it.
- Whether the validator should compare section names with their letter case is open.

## 8. Other measurements (left out of the repository, kept here as findings)

- **A website-reading recipe without a browser** (plain page fetch): 10 of 10 runs reached the menu page from the home page by themselves; 20 of 20 sections and all items but one (the page had changed since the reference was built, which was checked with `curl` and a script-driven Chrome, no model);
  but the **visual theme it was asked to extract came out invented** (`WebFetch` returns a summary, not HTML or CSS, and the agent said so in its report): none of 10 runs got the brand color right.
- **The same with a headless Chrome through a Playwright MCP server:** brand color right in 4 of 5 runs (the miss read a pure-red button as the brand), screenshots at the exact sizes asked, **faster and cheaper than the plain fetch** (88.6 s vs 126.7 s median, 0.021 vs 0.031 USD; deduced: each page fetch makes an internal model call to summarize the page and an in-page script does not),
  but **1.37 GB more RSS** (Chrome 1.24 GB; measured by PSS the browser tree is about 430 MB, so size a server between 0.55 and 1.2 GB per browser), 22 vs 12 turns. Three jobs in parallel (`MAX_PROCS=3`) took 95.5 s against 265.8 s in series, with a peak of 4.86 GB RSS, zero 429 or 529 errors and no mix-up between job folders (each carried its own id, no tool call named another job's path, one isolated Chrome profile per job).
  Bringing up Chrome costs about 0.85 s, the MCP server about 0.25 s.
- **A Playwright MCP detail:** the MCP does not return the page snapshot inline; it writes `.yml` files to its output folder and returns their path, so the prompt tells the agent to read the DOM with `browser_evaluate`. `run_code_unsafe` and `file_upload` were denied because they step out of the job folder.
  The browser reaches the internet and the local network without a filter; the job folder bounds files, not the network.
- **A rewrite-the-descriptions probe** (Haiku, one run per axis, direct API, 8 items): rewriting for **spelling and clarity** is safe (fixes spelling and agreement, adds no ingredient, leaves doubtful words alone and reports them, and finds real incoherences between a name and its description);
  rewriting for **appeal** goes too far (in 4 of 8 items it introduces a new fact and in one it removes an ingredient, mostly declared in its `doubts`). A mechanical alarm (words of the new text absent from the name and the old description) catches the new facts but also flags innocent grammar changes. For a product: each axis needs its own rules and review; spelling can go through with little review, appeal only as a proposal with original and new side by side.

## 9. What is not in the code and what was not done

- Not isolated: no container, no separate user, one shared API key, rules fence the SDK's tools and not the process; `callbackUrl` accepts any http(s) URL; no shared secret; the queue is in memory; job folders are never cleaned.
- Not measured: a rotated or glared photo, a 20-photo menu, image text that tries to give instructions, other menu designs, the swapped-ingredient and split-dish defects across more than 3 runs.
- Not done on purpose: checking the magic bytes of the images and the race between the folder scan and the copy.

## 10. How this published copy differs from what was measured

- State names are English (`registered`, `running`, `done`, `failed`); they were Spanish.
- Prompt wording, three edits for publication: the word that named the kind of business became "a food venue"; the default title of an untitled menu was a Spanish word and is now "Menu"; the example of a section note was a Spanish count of pieces and is now "(6 pieces)", and the OCR example file name is generic. The OCR language is `OCR_LANG` (default `eng`; the measurements used `spa`) and
  the prompts no longer say "not Spanish". **The prompts the results were measured with are not word for word the ones in this repository.**
- `validate.mjs` lost its theme, photo-URL and screenshot checks (they served the website recipes); `bench.mjs` lost the browser timings and now reads its key from `ANTHROPIC_API_KEY`.
- The data folders moved from a fixed path to `AGENT_RUNNER_STATE` (default under the OS temporary folder).
