import { expect, test } from "@playwright/test";

test("demo login opens the dashboard and navigates core views", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByText("Табло за анализ на злато")).toBeVisible();
  await page.getByRole("button", { name: "Влез в таблото" }).click();

  await expect(page).toHaveURL(/overview/);
  await expect(page.getByText("Контекстът за златото в един кадър.")).toBeVisible();
  await expect(page.getByText("Авто след")).toBeVisible();

  await page.getByRole("link", { name: "Новини" }).click();
  await expect(page.getByText("Какво означават последните новини за златото.")).toBeVisible();
  const liveNewsLinks = page.getByRole("link", { name: "Отвори източника" });
  const liveNewsCount = await liveNewsLinks.count();

  if (liveNewsCount > 0) {
    await expect(liveNewsLinks.first()).not.toHaveAttribute("href", /example\.com/);
  } else {
    await expect(page.getByText("Няма live новини за показване в момента.")).toBeVisible();
  }

  await page.getByRole("link", { name: "Календар" }).click();
  await expect(page.getByText("Календар за събития, които движат златото.")).toBeVisible();
  await expect(page.getByText("Календарен поток")).toBeVisible();
  const calendarRows = page.getByTestId("calendar-event-row");
  const calendarRowCount = await calendarRows.count();

  if (calendarRowCount > 0) {
    await calendarRows.first().click();
    await expect(page.getByTestId("calendar-event-detail")).toBeVisible();
    await expect(page.getByText("Bullish сценарий").first()).toBeVisible();
    await expect(page.getByText("Как влияе на златото")).toBeVisible();
    await page.getByRole("button", { name: "Затвори" }).click();
  } else {
    await expect(page.getByText("Няма live календарни събития за тази седмица.")).toBeVisible();
  }

  await page.getByRole("link", { name: "COT позиции" }).click();
  await expect(page.getByText("Къде стоят спекулативните и хеджиращите потоци.")).toBeVisible();

  await page.getByRole("link", { name: "Сигнал" }).click();
  await expect(page.getByText("Как е сметната посоката и къде тежат факторите.")).toBeVisible();
});
