export const timeDateFormat = new Intl.DateTimeFormat("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric" });
export const dateFormat = new Intl.DateTimeFormat("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
export const timeFormat = new Intl.DateTimeFormat("de-DE", { hour: "numeric", minute: "numeric" });
export const isoFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });

export function getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}