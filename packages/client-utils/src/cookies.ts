export function parseCookies(cookieString: string): Record<string, string> {
  return Object.fromEntries(
    cookieString.split(';').map((pair) => {
      const [key, ...valueParts] = pair.trim().split('=');
      return [key, valueParts.join('=')];
    })
  );
}
