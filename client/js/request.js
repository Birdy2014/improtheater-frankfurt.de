export class HTTPRequestError extends Error {
    constructor(response) {
        super(`HTTPRequestError status ${response.status}`)
        this.response = response
    }
}

async function request(method, url, body) {
    const headers = {};

    if (body instanceof FormData) {
        // do nothing
    } else if (typeof body === "object") {
        body = JSON.stringify(body);
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
        method,
        headers,
        body,
    });

    const content_type = response.headers.get("Content-Type");
    let data = undefined;
    if (content_type.startsWith("application/json")) {
        data = await response.json();
    } else if (content_type.startsWith("text/plain")
        || content_type.startsWith("text/html")
        || content_type === undefined) {
        data = await response.text();
    }

    const response_return = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    };

    if (!response.ok) {
        throw new HTTPRequestError(response_return);
    }

    return response_return;
}

export function get(url) {
    return request("GET", url, undefined);
}

export function post(url, data) {
    return request("POST", url, data);
}

export function put(url, data) {
    return request("PUT", url, data);
}

export function del(url, data) {
    return request("DELETE", url, data);
}
