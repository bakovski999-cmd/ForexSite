import { format } from "date-fns";

const sofiaDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  second: "2-digit",
  timeZone: "Europe/Sofia",
  year: "numeric",
});

const bgWeekdays = ["неделя", "понеделник", "вторник", "сряда", "четвъртък", "петък", "събота"];
const bgMonths = [
  "януари",
  "февруари",
  "март",
  "април",
  "май",
  "юни",
  "юли",
  "август",
  "септември",
  "октомври",
  "ноември",
  "декември",
];

function getDateTimeParts(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return Object.fromEntries(
    sofiaDateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

export function formatDateLabel(value: string) {
  return format(new Date(value), "dd MMM");
}

export function formatDateTimeLabel(value: string) {
  return format(new Date(value), "dd MMM yyyy, HH:mm");
}

export function formatSofiaDateTime(value: string, options?: { seconds?: boolean }) {
  const parts = getDateTimeParts(value);

  if (!parts) {
    return "-";
  }

  const date = `${parts.day}.${parts.month}.${parts.year}`;
  const time = `${parts.hour}:${parts.minute}${options?.seconds === false ? "" : `:${parts.second}`}`;

  return `${date}, ${time}`;
}

export function formatSofiaTime(value: string) {
  const parts = getDateTimeParts(value);

  if (!parts) {
    return "-";
  }

  return `${parts.hour}:${parts.minute}`;
}

export function formatSofiaDay(value: string) {
  const parts = getDateTimeParts(value);

  if (!parts) {
    return "-";
  }

  const monthIndex = Number(parts.month) - 1;
  const sofiaCalendarDate = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000Z`);
  const weekday = bgWeekdays[sofiaCalendarDate.getUTCDay()] ?? "";
  const month = bgMonths[monthIndex] ?? parts.month;

  return `${weekday}, ${parts.day} ${month}`;
}

export function formatSofiaDateKey(value: string) {
  const parts = getDateTimeParts(value);

  if (!parts) {
    return "";
  }

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("bg-BG", {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
