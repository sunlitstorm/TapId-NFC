import { storage } from "@/src/utils/storage";
import { uploadForm } from "@/src/utils/upload";

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "tapid_access_token";

let memoryToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export async function loadToken(): Promise<string | null> {
  memoryToken = ((await storage.secureGet(TOKEN_KEY, null)) as string | null) ?? null;
  return memoryToken;
}

export async function setToken(token: string | null) {
  memoryToken = token;
  if (token) await storage.secureSet(TOKEN_KEY, token);
  else await storage.secureRemove(TOKEN_KEY);
}

// Media reads go through the backend; <img> on web cannot send headers, so the session token rides in the query.
export function mediaUrl(path?: string | null): string | null {
  if (!path || !memoryToken) return null;
  return `${API_URL}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(memoryToken)}`;
}

type Parsable = { ok: boolean; status: number; text: () => Promise<string> };

async function parse<T>(res: Parsable, path: string): Promise<T> {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    const detail = data?.detail;
    const message = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((d: any) => d.msg).join(", ") : "Request failed";
    if (res.status === 401 && !path.startsWith("/auth/login")) onUnauthorized?.();
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: opts.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(memoryToken ? { Authorization: `Bearer ${memoryToken}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError("You appear to be offline. Check your connection and try again.", 0);
  }
  return parse<T>(res, path);
}

export async function uploadPhoto(file: { uri: string; name?: string; mimeType?: string }) {
  const res = await uploadForm(`${API_URL}/api/me/photo`, {
    headers: memoryToken ? { Authorization: `Bearer ${memoryToken}` } : undefined,
    files: { file },
  });
  return parse(res, "/me/photo");
}
