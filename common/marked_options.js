function escape_html_entities(html) {
    const replacements = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    };

    if (/[&<>"']/.test(html)) {
        return html.replace(/[&<>"']/g, ch => replacements[ch]);
    }

    return html;
}

export function common_marked_options(link_style) {
    return {
        gfm: true,
        breaks: true,
        headerIds: false,
        mangle: false,
        renderer: {
            link({ href, title, tokens }) {
                const text = this.parser.parseInline(tokens);
                try {
                    href = encodeURI(href).replace(/%25/g, "%");
                } catch {
                    return text;
                }
                let out = `<a href="${href}"`;
                if (title) {
                    out += ` title="${escape_html_entities(title)}"`;
                }
                if (link_style) {
                    out += ` style="${link_style}"`;
                }
                out += `>${text}</a>`;
                return out;
            },
            code({ text, escaped }) {
                const code = text.replace(/\n$/, '') + '\n';

                return '<pre>'
                    + (escaped ? code : escape_html_entities(code))
                    + '</pre>\n';
            }
        }
    }
};
