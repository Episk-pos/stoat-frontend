/* eslint-disable @typescript-eslint/no-explicit-any */
import { expect, test } from "@playwright/test";

// These tests require the app to be built with VITE_MOCK_RTC=true so the
// MockRoom code path is activated. Skip when the env var is absent (normal CI).
const isMockBuild = process.env.VITE_MOCK_RTC === "true";
const describeOrSkip = isMockBuild ? test.describe : test.describe.skip;

describeOrSkip("voice mock tests", () => {
  test("auto-spotlight follows active speaker in mock mode", async ({
    page,
  }) => {
    await page.goto("/e2e");

    // Wait for the local participant to be visible
    await expect(page.getByText("Local User")).toBeVisible();

    // Add a remote participant via the controller
    await page.evaluate(() => {
      (window as any).__STOAT_TEST_CONTROLLER__.addRemoteParticipant(
        "user-1",
        "Remote User 1",
      );
    });

    await expect(page.getByText("Remote User 1")).toBeVisible();

    // Simulate user-1 speaking
    await page.evaluate(() => {
      (window as any).__STOAT_TEST_CONTROLLER__.simulateActiveSpeakers([
        "user-1",
      ]);
    });

    // Verify user-1 is spotlighted
    const spotlightedTile = page
      .locator(".voice-tile")
      .filter({ hasText: "Remote User 1" });
    await expect(spotlightedTile).toHaveAttribute("data-spotlighted", "true");
  });

  test("screenshare takes priority in auto-spotlight", async ({ page }) => {
    await page.goto("/e2e");

    // Add a remote participant
    await page.evaluate(() => {
      (window as any).__STOAT_TEST_CONTROLLER__.addRemoteParticipant(
        "user-1",
        "Remote User 1",
      );
    });

    // Start screenshare for user-1
    await page.evaluate(() => {
      (window as any).__STOAT_TEST_CONTROLLER__.startScreenshare("user-1");
    });

    // User 1 screenshare should be spotlighted even if someone else speaks
    const screenshareTile = page
      .locator(".voice-tile")
      .filter({ hasText: "Remote User 1" });
    await expect(screenshareTile).toHaveAttribute("data-spotlighted", "true");
  });
});
