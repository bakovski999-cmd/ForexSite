import { describe, expect, test } from "vitest";

import {
  financeChartsBenchmarkUrl,
  parseFinanceChartsHistoricalMultiplePage,
} from "@/lib/financecharts-historical-multiples";

describe("FinanceCharts historical multiples parser", () => {
  test("extracts NVO EV/EBITDA period averages and line series", () => {
    const html = `
      <html>
        <head><title>NVO EV to EBITDA Ratio Chart</title></head>
        <body>
          <h1>NVO Average EV to EBITDA Ratio Chart</h1>
          <script>
            window.averageChartData = [
              ["Today", 8.21],
              ["TTM", 7.22],
              ["3Y", 12.00],
              ["5Y", 13.30],
              ["10Y", 13.11],
              ["15Y", 13.30],
              ["20Y", 12.45]
            ];
            Highcharts.chart("ratio", {
              series: [{
                name: "EV to EBITDA Ratio",
                data: [
                  [Date.UTC(2016, 4, 13), 14.25],
                  [Date.UTC(2022, 3, 22), 19.71],
                  [Date.UTC(2026, 4, 15), 8.21]
                ]
              }]
            });
          </script>
        </body>
      </html>
    `;

    const parsed = parseFinanceChartsHistoricalMultiplePage(html, "evToEbitda");

    expect(parsed.source).toBe("FinanceCharts");
    expect(parsed.sourceStatus).toBe("available");
    expect(parsed.currentMultiple).toBe(8.21);
    expect(parsed.periodAverages.find((period) => period.key === "10Y")).toMatchObject({
      average: 13.11,
      count: 1,
    });
    expect(parsed.seriesPoints).toContainEqual(
      expect.objectContaining({
        date: "2022-04-22",
        multiple: 19.71,
        source: "FinanceCharts",
      }),
    );
  });

  test("returns unavailable state for captcha pages", () => {
    const parsed = parseFinanceChartsHistoricalMultiplePage(
      "<html><head><title>Captcha Challenge - FinanceCharts.com</title></head></html>",
      "evToEbitda",
    );

    expect(parsed.source).toBe("FinanceCharts");
    expect(parsed.sourceStatus).toBe("unavailable");
    expect(parsed.sourceMessage).toMatch(/unavailable/i);
    expect(parsed.seriesPoints).toEqual([]);
    expect(parsed.periodAverages).toEqual([]);
  });

  test("builds benchmark URLs for supported metrics", () => {
    expect(financeChartsBenchmarkUrl("NVO", "evToEbitda")).toBe(
      "https://www.financecharts.com/stocks/NVO/value/ev-to-ebitda",
    );
    expect(financeChartsBenchmarkUrl("meta", "peRatio")).toBe(
      "https://www.financecharts.com/stocks/META/value/pe-ratio",
    );
  });
});
