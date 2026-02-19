import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Set the mock flag via local storage or however it is exposed
  // In our case it is a Vite env var, so we need to make sure the server is started with it.
});

test("auto-spotlight follows active speaker in mock mode", async ({ page }) => {
  // We need VITE_MOCK_RTC=true. For this test to run reliably in CI,
  // we might need to configure a separate GHA job or use a different baseURL.
  // For now, we assume the server is running with the mock flag.

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
    (window as any).__STOAT_TEST_CONTROLLER__.simulateActiveSpeakers(["user-1"]);
  });

  // Verify user-1 is spotlighted (should have the spotlight outline or be in the stage)
  const spotlightedTile = page.locator(".voice-tile").filter({ hasText: "Remote User 1" });
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
  const screenshareTile = page.locator(".voice-tile").filter({ hasText: "Remote User 1" });
  await expect(screenshareTile).toHaveAttribute("data-spotlighted", "true");
});
