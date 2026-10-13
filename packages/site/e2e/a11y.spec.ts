/**
 * The accessibility checks: axe examines the main pages in the light theme and in the dark theme.
 * A finding with the impact "serious" or "critical" fails the test.
 */
import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGES = ["", "playground/", "learn/tour/", "reference/options/"];
const THEMES = ["light", "dark"] as const;

for (const theme of THEMES) {
  for (const path of PAGES) {
    test(`axe: /${path} in the ${theme} theme`, async ({ page }) => {
      // Starlight and the playground read the theme of the reader from this key.
      await page.addInitScript((value) => {
        localStorage.setItem("starlight-theme", value);
      }, theme);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      // The islands of React render after the load. The checks examine the page after them.
      await page.waitForLoadState("networkidle");
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const bad = result.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(
        bad.map((v) => `${v.id} (${v.impact ?? ""}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).join("\n  ")}`),
        `/${path}, ${theme}`,
      ).toEqual([]);
    });
  }
}
