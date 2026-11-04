'use strict';

const https = require('https');


// ============================================================
// HARD-CODED DISCORD FAVICON
// ============================================================

const FAVICON_URL =
    'https://cdn.discordapp.com/icons/1534681124134191294/93d31378d80fb9f583d263199a65f22a.webp?size=160&quality=lossless';


// ============================================================
// FAVICON DATA
// ============================================================

let faviconData = null;


// ============================================================
// DOWNLOAD FAVICON
// ============================================================

function downloadFavicon() {

    return new Promise((resolve, reject) => {

        https.get(
            FAVICON_URL,
            response => {

                if (
                    response.statusCode < 200 ||
                    response.statusCode >= 300
                ) {

                    response.resume();

                    return reject(
                        new Error(
                            `Discord returned HTTP ${response.statusCode}`
                        )
                    );

                }


                const chunks = [];


                response.on(
                    'data',
                    chunk => {

                        chunks.push(chunk);

                    }
                );


                response.on(
                    'end',
                    () => {

                        faviconData =
                            Buffer.concat(chunks);


                        console.log(
                            `[Favicon] Loaded Discord favicon: ${faviconData.length} bytes`
                        );


                        resolve();

                    }
                );


                response.on(
                    'error',
                    reject
                );

            }
        ).on(
            'error',
            reject
        );

    });

}


// ============================================================
// LOAD ON STARTUP
// ============================================================

downloadFavicon()
    .catch(error => {

        console.error(
            '[Favicon] Failed to download favicon:',
            error.message
        );

    });


// ============================================================
// SERVE FAVICON
// ============================================================

function faviconHandler(req, res) {

    if (!faviconData) {

        res.statusCode = 503;

        res.setHeader(
            'Content-Type',
            'text/plain; charset=utf-8'
        );

        return res.end(
            'Favicon is still loading'
        );

    }


    res.statusCode = 200;

    res.setHeader(
        'Content-Type',
        'image/webp'
    );

    res.setHeader(
        'Content-Length',
        faviconData.length
    );

    res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate'
    );

    res.setHeader(
        'Pragma',
        'no-cache'
    );

    res.setHeader(
        'Expires',
        '0'
    );

    res.setHeader(
        'X-Favicon-Controller',
        'Los Angeles California Roleplay'
    );

    res.end(
        faviconData
    );

}


// ============================================================
// REGISTER ROUTES
// ============================================================

function registerFavicon(app) {

    app.get(
        '/favicon.webp',
        faviconHandler
    );


    app.get(
        '/favicon.png',
        faviconHandler
    );


    app.get(
        '/favicon.ico',
        faviconHandler
    );


    console.log(
        '[Favicon] Favicon controller registered'
    );

}


// ============================================================
// HTML FAVICON INJECTION
// ============================================================
//
// This forces the favicon into proxied HTML pages.
//

function injectFavicon(html) {

    const faviconHTML = `
<link rel="icon" type="image/webp" href="/favicon.webp?v=1">
<link rel="shortcut icon" href="/favicon.webp?v=1">
`;

    // Remove existing favicon declarations.

    html = html.replace(
        /<link[^>]+rel=["'](?:shortcut\s+icon|icon)["'][^>]*>/gi,
        ''
    );


    // Add our favicon immediately before </head>.

    if (
        /<\/head>/i.test(html)
    ) {

        return html.replace(
            /<\/head>/i,
            `${faviconHTML}</head>`
        );

    }


    // Fallback if the page has no </head>.

    return `${faviconHTML}${html}`;

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
    registerFavicon,
    injectFavicon
};