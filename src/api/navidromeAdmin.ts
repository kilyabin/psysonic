import { invoke } from '@tauri-apps/api/core';

export interface NdUser {
  id: string;
  userName: string;
  name: string;
  email: string;
  isAdmin: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface NdLoginResult {
  token: string;
  userId: string;
  isAdmin: boolean;
}

export async function ndLogin(
  serverUrl: string,
  username: string,
  password: string,
): Promise<NdLoginResult> {
  return invoke<NdLoginResult>('navidrome_login', { serverUrl, username, password });
}

export async function ndListUsers(serverUrl: string, token: string): Promise<NdUser[]> {
  const raw = await invoke<unknown>('nd_list_users', { serverUrl, token });
  if (!Array.isArray(raw)) return [];
  return raw.map(u => {
    const o = u as Record<string, unknown>;
    return {
      id: String(o.id ?? ''),
      userName: String(o.userName ?? ''),
      name: String(o.name ?? ''),
      email: String(o.email ?? ''),
      isAdmin: !!o.isAdmin,
      lastLoginAt: (o.lastLoginAt as string | null | undefined) ?? null,
      createdAt: o.createdAt as string | undefined,
      updatedAt: o.updatedAt as string | undefined,
    };
  });
}

export async function ndCreateUser(
  serverUrl: string,
  token: string,
  data: { userName: string; name: string; email: string; password: string; isAdmin: boolean },
): Promise<void> {
  await invoke('nd_create_user', { serverUrl, token, ...data });
}

export async function ndUpdateUser(
  serverUrl: string,
  token: string,
  id: string,
  data: { userName: string; name: string; email: string; password: string; isAdmin: boolean },
): Promise<void> {
  await invoke('nd_update_user', { serverUrl, token, id, ...data });
}

export async function ndDeleteUser(serverUrl: string, token: string, id: string): Promise<void> {
  await invoke('nd_delete_user', { serverUrl, token, id });
}
