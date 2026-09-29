// Friend metadata is published content, not permission to contact local services.
export function publicURL(value: string, base?: string): string | undefined {
  if (!value.trim()) return;
  try {
    const u = new URL(value, base);
    const host = u.hostname.toLowerCase();
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      u.port ||
      !host.includes(".") ||
      /^[\d.]+$/.test(host) ||
      host.includes(":") ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(host)
    )
      return;
    u.hash = "";
    return u.href;
  } catch {
    return;
  }
}
