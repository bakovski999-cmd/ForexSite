"use client";

import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";

type TooltipParam = {
  axisValue?: string;
};

type TooltipSize = {
  contentSize: [number, number];
  viewSize: [number, number];
};

function formatDeltaCompact(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const absolute = Math.abs(value);

  if (absolute >= 1000) {
    return `${sign}${(absolute / 1000).toFixed(absolute >= 100000 ? 0 : 1)}K`;
  }

  return `${sign}${absolute}`;
}

function formatContracts(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${new Intl.NumberFormat("en-US").format(Math.abs(value))}`;
}

function describeDelta(value: number) {
  if (value > 0) {
    return "нетната дълга позиция се увеличава";
  }

  if (value < 0) {
    return "нетната дълга позиция намалява";
  }

  return "няма промяна в нетната позиция";
}

function getTooltipPosition(point: number[], _params: unknown, _dom: unknown, _rect: unknown, size: TooltipSize) {
  const margin = 12;
  const [pointerX, pointerY] = point;
  const [contentWidth, contentHeight] = size.contentSize;
  const [viewWidth, viewHeight] = size.viewSize;

  const preferredLeft = pointerX + margin;
  const preferredTop = pointerY - contentHeight - margin;
  const maxLeft = Math.max(margin, viewWidth - contentWidth - margin);
  const maxTop = Math.max(margin, viewHeight - contentHeight - margin);

  return [
    Math.min(Math.max(preferredLeft, margin), maxLeft),
    Math.min(Math.max(preferredTop, margin), maxTop),
  ];
}

function buildCotDeltaOption(labels: string[], deltas: number[]): EChartsOption {
  const positiveDeltas = deltas.map((value) => (value > 0 ? value : null));
  const negativeDeltas = deltas.map((value) => (value < 0 ? value : null));
  const fullValueByLabel = new Map(labels.map((label, index) => [label, deltas[index]]));

  return {
    tooltip: {
      trigger: "axis",
      appendTo: "body",
      confine: true,
      extraCssText: [
        "max-width: min(320px, calc(100vw - 32px))",
        "white-space: normal",
        "line-height: 1.45",
        "padding: 12px 14px",
        "border-radius: 14px",
        "box-shadow: 0 18px 42px rgba(2,6,23,0.32)",
        "z-index: 9999",
      ].join(";"),
      position: getTooltipPosition,
      axisPointer: {
        type: "shadow",
        shadowStyle: { color: "rgba(148,163,184,0.08)" },
      },
      backgroundColor: "#0f1729",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#f8fafc" },
      formatter: (params) => {
        const entries = Array.isArray(params) ? (params as TooltipParam[]) : [params as TooltipParam];
        const label = entries[0]?.axisValue ?? "";
        const value = fullValueByLabel.get(label) ?? 0;

        return [
          `<strong>Седмица: ${label}</strong>`,
          `Промяна: ${formatContracts(value)} контракта`,
          `Значение: ${describeDelta(value)}`,
        ].join("<br/>");
      },
    },
    grid: { left: 46, right: 20, top: 34, bottom: 36, containLabel: true },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { color: "#94a3b8", hideOverlap: true, interval: 1 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.14)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#94a3b8",
        formatter: (value: number) => formatDeltaCompact(value),
      },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
    },
    series: [
      {
        name: "Увеличение",
        type: "bar",
        data: positiveDeltas,
        barWidth: 20,
        itemStyle: {
          borderRadius: [5, 5, 0, 0],
          color: "#34d399",
        },
        label: {
          show: true,
          position: "top",
          color: "#e2e8f0",
          fontSize: 11,
          formatter: (params) => {
            const value = Number(params.value ?? 0);
            return Math.abs(value) >= 5000 ? formatDeltaCompact(value) : "";
          },
        },
        labelLayout: {
          hideOverlap: true,
        },
        markLine: {
          symbol: "none",
          silent: true,
          lineStyle: { color: "rgba(226,232,240,0.42)", width: 1 },
          data: [{ yAxis: 0 }],
          label: { show: false },
        },
      },
      {
        name: "Намаление",
        type: "bar",
        data: negativeDeltas,
        barWidth: 20,
        itemStyle: {
          borderRadius: [0, 0, 5, 5],
          color: "#fb7185",
        },
        label: {
          show: true,
          position: "bottom",
          color: "#e2e8f0",
          fontSize: 11,
          formatter: (params) => {
            const value = Number(params.value ?? 0);
            return Math.abs(value) >= 5000 ? formatDeltaCompact(value) : "";
          },
        },
        labelLayout: {
          hideOverlap: true,
        },
      },
    ],
  };
}

export function CotDeltaChart({
  labels,
  deltas,
  height = 320,
}: {
  labels: string[];
  deltas: number[];
  height?: number;
}) {
  return <BaseChart height={height} option={buildCotDeltaOption(labels, deltas)} />;
}
