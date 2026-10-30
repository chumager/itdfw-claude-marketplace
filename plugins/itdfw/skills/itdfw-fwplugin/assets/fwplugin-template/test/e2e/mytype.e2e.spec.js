// Runs from the console (`pnpm exec playwright test test/e2e --reporter=line`), never through a browser MCP.
import {test, expect} from "@playwright/test";

const HOST = process.env.ITDFW_HOST ?? "https://dev.localhost:9090";

test.describe("MyType — the type at the 4 nesting levels", () => {
  test("typing at every level round-trips through save, grid and detail", async ({page}) => {
    const response = await page.goto(`${HOST}/MyTypeTest/Create`);
    test.skip(response?.status() === 404, "MyTypeTest is not loaded (not dev)");

    await page.getByLabel("Value").fill("…");
    await page.getByRole("button", {name: /guardar|save/i}).click();

    await page.goto(`${HOST}/MyTypeTest`);
    await expect(page.getByRole("cell", {name: "…"})).toBeVisible();
  });
});
