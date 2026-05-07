import { expect, test } from "@playwright/test";

test("demo login opens the dashboard and navigates core views", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByText("Табло за анализ на злато")).toBeVisible();
  await page.getByRole("button", { name: "Влез в таблото" }).click();

  await expect(page).toHaveURL(/overview/, { timeout: 20_000 });
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
    const calendarDetail = page.getByTestId("calendar-event-detail");
    await expect(calendarDetail).toBeVisible();
    await expect(page.getByText("Bullish сценарий").first()).toBeVisible();
    await expect(calendarDetail.getByText("Как влияе на златото")).toBeVisible();
    await page.getByRole("button", { name: "Затвори" }).click();
  } else {
    await expect(
      page.getByText(
        /Няма live календарни събития за тази седмица\.|Няма събития по тези филтри\.|Няма събития за избрания ден\./,
      ),
    ).toBeVisible();
  }

  await page.getByRole("link", { name: "COT позиции" }).click();
  await expect(page.getByText("Къде стоят спекулативните и хеджиращите потоци.")).toBeVisible();

  await page.getByRole("link", { name: "Сигнал" }).click();
  await expect(page.getByText("Как е сметната посоката и къде тежат факторите.")).toBeVisible();

  await page.getByRole("link", { name: "Риск калкулатор" }).click();
  await expect(
    page.getByText("Провери риска по реалните данни от твоя брокер."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /Входни данни \/ Резултат/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Продажба на части/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Осредняване/ })).toBeVisible();
  await expect(page.getByText("Ако цената падне до")).toBeVisible();
  await expect(page.getByText("печалбата ще е")).toBeVisible();

  await page.getByRole("button", { name: /Допълнителни настройки/ }).click();
  await expect(page.getByRole("button", { name: /Реален маржин от брокера/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Пример: продукт 1:20" })).toBeVisible();

  await page.getByRole("button", { name: /Продажба на части/ }).click();
  await expect(page.getByRole("heading", { name: "Частични продажби" })).toBeVisible();
  await expect(page.getByText("Цена на покупка").first()).toBeVisible();
  await expect(page.getByText("Купени акции").first()).toBeVisible();
  await expect(page.getByText("Продавам акции").first()).toBeVisible();

  await page.getByRole("button", { name: /Осредняване/ }).click();
  await expect(page.getByRole("heading", { name: "Натрупване / осредняване" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Колко акции мога да взема?" })).toHaveCount(0);
});
