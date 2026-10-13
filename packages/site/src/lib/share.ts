/**
 * The state of the playground in the URL. The text goes through the deflate compression of the browser and base64url,
 * so a link holds a large document and needs no server.
 */

const PREFIX = "z:";

/** This function gives the text as a short string for the hash of a URL. */
export async function encodeState(text: string): Promise<string> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  return PREFIX + toBase64Url(bytes);
}

/** This function gives the text of a string from `encodeState`, or undefined for a bad string. */
export async function decodeState(value: string): Promise<string | undefined> {
  if (!value.startsWith(PREFIX)) return undefined;
  try {
    const bytes = fromBase64Url(value.slice(PREFIX.length));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).text();
  } catch {
    return undefined;
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}
