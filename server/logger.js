export async function error(message) {
    console.error("\x1b[1;31mERROR: %s\x1b[0m", message)
}

export async function warn(message) {
    console.warn("\x1b[0;33mWARN: %s\x1b[0m", message)
}

export async function info(message) {
    console.info(message)
}
