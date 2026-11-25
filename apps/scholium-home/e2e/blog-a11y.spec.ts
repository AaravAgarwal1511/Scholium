import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Same gate as the other apps: zero serious/critical WCAG 2.1 A/AA violations,
// color-contrast excluded (token-dependent; a separate design pass owns it).
for (const path of ["/blog", "/blog/why-spaced-repetition-works", "/blog/no-such-post"]) {
  test(`a11y: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("button", { name: "Study tools" })).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"])
      .analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`)).toEqual([]);
  });
}
