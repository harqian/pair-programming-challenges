import { getContext, setContext } from "svelte";
import type YPartyKitProvider from "y-partykit/provider";
import type * as Y from "yjs";

const YJS_PROVIDER_KEY = Symbol("yjsProvider");
const YJS_DOC_KEY = Symbol("yjsDoc");

export function setYjsProvider(provider: YPartyKitProvider) {
    setContext(YJS_PROVIDER_KEY, provider);
}

export function getYjsProvider(): YPartyKitProvider {
    return getContext(YJS_PROVIDER_KEY);
}

export function setYjsDoc(doc: Y.Doc) {
    setContext(YJS_DOC_KEY, doc);
}

export function getYjsDoc(): Y.Doc {
    return getContext(YJS_DOC_KEY);
}

// For non-Y clients, get the socket from the provider
export function getPartySocket() {
    return getYjsProvider().ws;
}