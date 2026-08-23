/** Canonical deployed URL of the scholium-home hub.
 *
 *  The hub is intentionally NOT a row in the `scholium_apps` table (that table
 *  only holds the tools), so apps cannot resolve it via
 *  `apps.find(a => a.id === "scholium-home")?.url` — that lookup always returns
 *  undefined. Apps import this constant for the navbar logo / home link. */
export const SCHOLIUM_HOME_URL = "https://www.thescholium.com";
