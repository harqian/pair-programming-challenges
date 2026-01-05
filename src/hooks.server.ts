import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
    const response = await resolve(event);

    // 1. Cross-Origin-Opener-Policy: same-origin
    // Isolates the browsing context to same-origin documents. 
    // This allows the use of SharedArrayBuffer.
    response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');

    // 2. Cross-Origin-Embedder-Policy: require-corp
    // Ensures that the document can only load resources that explicitly grant permission.
    response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

    return response;
};