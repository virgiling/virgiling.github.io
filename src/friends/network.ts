import { lookup } from "node:dns/promises";
import { get } from "node:https";
import { publicURL } from "./urls";

export function publicAddress(address: string) {
  if (address.includes(":"))
    return (
      /^[23][0-9a-f]{3}:/i.test(address) && !/^2001:(?:db8|0):/i.test(address)
    );
  const [a, b] = address.split(".").map(Number);
  return (
    a > 0 &&
    a < 224 &&
    a !== 10 &&
    a !== 127 &&
    !(a === 169 && b === 254) &&
    !(a === 172 && b >= 16 && b <= 31) &&
    !(a === 192 && (b === 168 || b === 0)) &&
    !(a === 100 && b >= 64 && b <= 127) &&
    !(a === 198 && (b === 18 || b === 19))
  );
}
export async function readPublicText(
  value: string,
  signal?: AbortSignal,
  redirects = 0,
): Promise<{ text: string; url: string }> {
  const url = publicURL(value);
  if (!url || redirects > 3)
    throw new Error("Unsupported feed URL or redirect");
  const timeout = AbortSignal.timeout(6000);
  const abort = signal ? AbortSignal.any([signal, timeout]) : timeout;
  // Pin the vetted DNS result for the connection, rather than resolving again in fetch.
  abort.throwIfAborted();
  let onAbort = () => {};
  const addresses = await Promise.race([
    lookup(new URL(url).hostname, { all: true }),
    new Promise<never>((_, reject) => {
      onAbort = () => reject(abort.reason);
      abort.addEventListener("abort", onAbort, { once: true });
    }),
  ]).finally(() => abort.removeEventListener("abort", onAbort));
  abort.throwIfAborted();
  if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
    throw new Error("Feed resolves to a non-public address");
  const address = addresses.find((a) => a.family === 4) || addresses[0];
  const result = await new Promise<{ text?: string; location?: string }>(
    (resolve, reject) => {
      const request = get(
        url,
        {
          signal: abort,
          family: address.family,
          lookup: (_host, _options, callback) =>
            callback(null, address.address, address.family),
          headers: {
            "User-Agent": "Notes-Friend-Circle/1.0",
            Accept:
              "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9",
          },
        },
        (response) => {
          if (
            [301, 302, 303, 307, 308].includes(response.statusCode || 0) &&
            response.headers.location
          ) {
            response.resume();
            resolve({ location: new URL(response.headers.location, url).href });
            return;
          }
          if (response.statusCode !== 200) {
            response.resume();
            reject(new Error(`Feed HTTP ${response.statusCode}`));
            return;
          }
          const chunks: Buffer[] = [];
          let bytes = 0;
          response.on("data", (chunk) => {
            bytes += chunk.length;
            if (bytes > 2 * 1024 * 1024) {
              request.destroy(new Error("Feed exceeds 2 MiB"));
              return;
            }
            chunks.push(Buffer.from(chunk));
          });
          response.on("end", () =>
            resolve({ text: Buffer.concat(chunks).toString("utf8") }),
          );
          response.on("error", reject);
        },
      );
      request.on("error", reject);
    },
  );
  if (result.location)
    return readPublicText(result.location, abort, redirects + 1);
  return { text: result.text!, url };
}
