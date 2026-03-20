"use client";

import { createContext, useEffect, useState, ReactNode, useCallback } from "react";
import { migrateLegacyLocalUserStateToUser } from "../lib/localUserStateMigration";

export interface AuthUser {
    userId: string;
    email: string | null;
    displayName: string | null;
}

export interface AuthContextValue {
    user: AuthUser | null;
    loading: boolean;
    refreshSession: () => Promise<void>;
    signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchSession = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/auth/session", {
                cache: "no-store",
                credentials: "same-origin",
                headers: {
                    "cache-control": "no-store",
                },
            });
            if (res.ok) {
                const data = await res.json();
                if (data.authenticated && data.userId) {
                    try {
                        migrateLegacyLocalUserStateToUser(data.userId);
                    } catch (migrationError) {
                        console.error("Failed to migrate legacy local state", migrationError);
                    }
                    setUser({
                        userId: data.userId,
                        email: data.email ?? null,
                        displayName: data.displayName ?? null,
                    });
                } else {
                    setUser(null);
                }
            } else if (res.status === 401 || res.status === 403) {
                setUser(null);
            }
        } catch (err) {
            console.error("Failed to fetch session", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchSession();
    }, [fetchSession]);

    const signOut = useCallback(async () => {
        try {
            await fetch("/api/auth/session", {
                method: "DELETE",
                cache: "no-store",
                credentials: "same-origin",
            });
            setUser(null);
        } catch (err) {
            console.error("Failed to sign out", err);
        }
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, refreshSession: fetchSession, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}
