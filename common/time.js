export const timeDateFormat = Intl.DateTimeFormat("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric" });
export const dateFormat = Intl.DateTimeFormat("de-DE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
export const timeFormat = Intl.DateTimeFormat("de-DE", { hour: "numeric", minute: "numeric" });
export const isoFormat = Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });

export function getCurrentTimestamp() {
    return Math.floor(Date.now() / 1000);
}
