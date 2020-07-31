exports.getCurrentTimestamp = () => {
    return Math.floor(Date.now() / 1000);
}

/**
 * Generates random string
 * @param {number} length 
 * @returns {string}
 */
exports.generateToken = (length) => {
    let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz1234567890";
    let text = "";
    for (let i = 0; i < length; i++)
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    return text;
}