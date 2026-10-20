export function req(path: string, method: string, body?: unknown, headers: Record<string, string> = {}): Request {
  const init: RequestInit = { method, headers: { ...(body !== undefined ? { "content-type": "application/json" } : {}), ...headers } };
  if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
  return new Request(`http://localhost${path}`, init);
}
export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
export async function body(r: Response): Promise<Record<string, any>> { return (await r.json()) as Record<string, any>; } // eslint-disable-line @typescript-eslint/no-explicit-any
