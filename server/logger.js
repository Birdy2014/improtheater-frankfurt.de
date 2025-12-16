import { ppid } from "process";

function formatJournald(level, message) {
    return message.split("\n").map(s => `<${level}>${s}`).join("\n")
}

export function error(message) {
    if (ppid === 1) {
        console.error(formatJournald(3, message))
    } else {
        console.error("\x1b[1;31m%s\x1b[0m", message)
    }
}

export function warn(message) {
    if (ppid === 1) {
        console.warn(formatJournald(4, message))
    } else {
        console.warn("\x1b[0;33m%s\x1b[0m", message)
    }
}

export function info(message) {
    if (ppid === 1) {
        console.info(formatJournald(6, message))
    } else {
        console.info(message)
    }
}
