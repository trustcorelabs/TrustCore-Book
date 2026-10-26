import { occupiedInterval } from "./policy";
export type ScheduleRule = {
  weekday: number;
  startMinute: number;
  endMinute: number;
};
export type TimeBlock = { startsAt: Date; endsAt: Date };

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const dateFormatters = new Map<string, Intl.DateTimeFormat>();
export function businessLocalDate(instant: Date, timezone: string) {
  let formatter = dateFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    if (dateFormatters.size >= 128) dateFormatters.clear();
    dateFormatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(instant);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function resolveBusinessLocalTime(
  date: string,
  time: string,
  timezone: string,
) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  )
    return null;
  const base = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(base)) return null;
  const matches: Date[] = [];
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = new Date(base + offset * 60_000);
    const local = localParts(candidate, timezone);
    if (
      local.day === date &&
      local.minute === Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
    )
      matches.push(candidate);
  }
  return matches.length === 1 ? matches[0] : null;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function localParts(instant: Date, timezone: string) {
  let formatter = formatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (formatters.size >= 128) formatters.clear();
    formatters.set(timezone, formatter);
  }
  const parts = formatter.formatToParts(instant);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return {
    day: `${value("year")}-${value("month")}-${value("day")}`,
    weekday: weekdays.indexOf(value("weekday")),
    minute: Number(value("hour")) * 60 + Number(value("minute")),
  };
}

export function isBookableInterval(input: {
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  rules: ScheduleRule[];
  exceptions: TimeBlock[];
  appointments: TimeBlock[];
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
}) {
  const { timezone, rules, exceptions, appointments } = input;
  const { startsAt, endsAt } = occupiedInterval(input);
  if (!(endsAt > startsAt)) return false;
  const start = localParts(startsAt, timezone);
  const end = localParts(new Date(endsAt.getTime() - 1), timezone);
  // Rules cannot span local midnight. Testing the last occupied minute also
  // handles a slot ending exactly at midnight.
  if (start.day !== end.day) return false;
  const endMinute = end.minute + 1;
  if (
    endMinute - start.minute !==
    (endsAt.getTime() - startsAt.getTime()) / 60_000
  )
    return false;
  if (
    !rules.some(
      (rule) =>
        rule.weekday === start.weekday &&
        start.minute >= rule.startMinute &&
        endMinute <= rule.endMinute,
    )
  )
    return false;
  return ![...exceptions, ...appointments].some(
    (block) => startsAt < block.endsAt && endsAt > block.startsAt,
  );
}

export function computeSlots(input: {
  from: Date;
  to: Date;
  durationMinutes: number;
  timezone: string;
  rules: ScheduleRule[];
  exceptions: TimeBlock[];
  appointments: TimeBlock[];
  now?: Date;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  bookingLeadMinutes?: number;
  bookingHorizonDays?: number;
}) {
  const {
    from,
    to,
    durationMinutes,
    timezone,
    rules,
    exceptions,
    appointments,
  } = input;
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes < 5 ||
    durationMinutes > 720 ||
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime())
  )
    return [];
  const first =
    Math.ceil(
      Math.max(
        from.getTime(),
        (input.now ?? new Date()).getTime() +
          (input.bookingLeadMinutes ?? 60) * 60_000,
      ) / 60_000,
    ) * 60_000;
  const slots: TimeBlock[] = [];
  for (
    let time = first;
    time + durationMinutes * 60_000 <=
    Math.min(
      to.getTime(),
      (input.now ?? new Date()).getTime() +
        (input.bookingHorizonDays ?? 60) * 86400000,
    );
    time += 60_000
  ) {
    const startsAt = new Date(time);
    const local = localParts(startsAt, timezone);
    // Anchor the 30-minute cadence to each working interval, including 09:15 starts.
    if (
      !rules.some(
        (rule) =>
          rule.weekday === local.weekday &&
          local.minute >= rule.startMinute &&
          (local.minute - rule.startMinute) % 30 === 0,
      )
    )
      continue;
    const endsAt = new Date(time + durationMinutes * 60_000);
    if (
      isBookableInterval({
        startsAt,
        endsAt,
        timezone,
        rules,
        exceptions,
        appointments,
        bufferBeforeMinutes: input.bufferBeforeMinutes,
        bufferAfterMinutes: input.bufferAfterMinutes,
      })
    )
      slots.push({ startsAt, endsAt });
  }
  return slots;
}
