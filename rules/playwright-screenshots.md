# Playwright: do NOT name the screenshots

In `browser_take_screenshot` **do not pass `filename`**. The tool prepends `./` to any bare name → it lands in the project ROOT and dirties it.

Omit `filename`: the MCP auto-names in `.playwright-mcp/` and **returns the path in the response** → use it from there.

If you need a meaningful name: `filename: ".playwright-mcp/<name>.png"` (explicit prefix). Never bare.

The MCP's `--output-dir` does NOT fix the `filename` case (tested with the flag active).
