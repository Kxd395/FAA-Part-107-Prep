import crypto from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const isVercel = process.env.VERCEL === "1";
const PROFILE_DIR = isVercel ? "/tmp/.data" : path.join(process.cwd(), ".data");
const PROFILE_FILE = path.join(PROFILE_DIR, "user-profiles-v1.json");

export interface UserProfile {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    createdAt: string;
    updatedAt: string;
}

interface PersistedProfileStore {
    version: 1;
    /** Keyed by user id */
    profiles: Record<string, UserProfile>;
    /** Keyed by lowercase email → user id */
    emailIndex: Record<string, string>;
}

declare global {
    // eslint-disable-next-line no-var
    var __part107UserProfileCache__: PersistedProfileStore | undefined;
}

async function loadStore(): Promise<PersistedProfileStore> {
    if (globalThis.__part107UserProfileCache__) {
        return globalThis.__part107UserProfileCache__;
    }

    try {
        const raw = await readFile(PROFILE_FILE, "utf8");
        const parsed = JSON.parse(raw) as PersistedProfileStore;
        if (
            parsed?.version === 1 &&
            parsed.profiles &&
            typeof parsed.profiles === "object" &&
            parsed.emailIndex &&
            typeof parsed.emailIndex === "object"
        ) {
            globalThis.__part107UserProfileCache__ = parsed;
            return parsed;
        }
    } catch {
        // fall through
    }

    const empty: PersistedProfileStore = {
        version: 1,
        profiles: {},
        emailIndex: {},
    };
    globalThis.__part107UserProfileCache__ = empty;
    return empty;
}

async function saveStore(store: PersistedProfileStore): Promise<void> {
    await mkdir(PROFILE_DIR, { recursive: true });
    await writeFile(PROFILE_FILE, JSON.stringify(store), "utf8");
    globalThis.__part107UserProfileCache__ = store;
}

function generateUserId(): string {
    return `u_${crypto.randomBytes(12).toString("hex")}`;
}

function emailAsDisplayName(email: string): string {
    const atIndex = email.indexOf("@");
    if (atIndex > 0) return email.slice(0, atIndex);
    return email;
}

// ─── Public API ───

export async function getUserProfileById(
    id: string
): Promise<UserProfile | null> {
    const store = await loadStore();
    return store.profiles[id] ?? null;
}

export async function getUserProfileByEmail(
    email: string
): Promise<UserProfile | null> {
    const store = await loadStore();
    const normalizedEmail = email.toLowerCase().trim();
    const userId = store.emailIndex[normalizedEmail];
    if (!userId) return null;
    return store.profiles[userId] ?? null;
}

export async function findOrCreateUserByEmail(
    email: string
): Promise<{ profile: UserProfile; created: boolean }> {
    const normalizedEmail = email.toLowerCase().trim();
    const existing = await getUserProfileByEmail(normalizedEmail);
    if (existing) {
        return { profile: existing, created: false };
    }

    const store = await loadStore();
    const now = new Date().toISOString();
    const profile: UserProfile = {
        id: generateUserId(),
        email: normalizedEmail,
        displayName: emailAsDisplayName(normalizedEmail),
        avatarUrl: null,
        createdAt: now,
        updatedAt: now,
    };

    store.profiles[profile.id] = profile;
    store.emailIndex[normalizedEmail] = profile.id;
    await saveStore(store);

    return { profile, created: true };
}

export async function updateUserProfile(
    id: string,
    updates: { displayName?: string; avatarUrl?: string | null }
): Promise<UserProfile | null> {
    const store = await loadStore();
    const profile = store.profiles[id];
    if (!profile) return null;

    if (updates.displayName !== undefined) {
        const trimmed = updates.displayName.trim();
        if (trimmed.length > 0 && trimmed.length <= 100) {
            profile.displayName = trimmed;
        }
    }
    if (updates.avatarUrl !== undefined) {
        profile.avatarUrl = updates.avatarUrl;
    }
    profile.updatedAt = new Date().toISOString();
    store.profiles[id] = profile;
    await saveStore(store);

    return profile;
}

export async function clearUserProfileStoreForTests(): Promise<void> {
    const store = await loadStore();
    store.profiles = {};
    store.emailIndex = {};
    await saveStore(store);
}
