function escape_html_entities(html: string): string {
    const replacements: Record<string, string> = {
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

interface MarkedLinkToken {
    href: string;
    title: string | null;
    tokens: Array<{ raw: string; text: string }>;
}

interface MarkedCodeToken {
    text: string;
    escaped: boolean;
}

interface MarkedLinkRenderer {
    parser: {
        parseInline(tokens: Array<{ raw: string; text: string }>): string;
    };
}

interface MarkedCodeRenderer {
    parser: {
        parseInline(tokens: Array<{ raw: string; text: string }>): string;
    };
}

export function common_marked_options(link_style?: string | null): object {
    return {
        gfm: true,
        breaks: true,
        headerIds: false,
        mangle: false,
        renderer: {
            link(this: MarkedLinkRenderer, { href, title, tokens }: MarkedLinkToken) {
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
            code(this: MarkedCodeRenderer, { text, escaped }: MarkedCodeToken) {
                const code = text.replace(/\n$/, '') + '\n';

                return '<pre>'
                    + (escaped ? code : escape_html_entities(code))
                    + '</pre>\n';
            }
        }
    }
};