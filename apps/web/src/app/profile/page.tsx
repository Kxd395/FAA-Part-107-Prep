"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../hooks/useAuth";
import Link from "next/link";

export default function ProfilePage() {
    const { user, loading, refreshSession, signOut } = useAuth();
    const router = useRouter();

    const [displayName, setDisplayName] = useState(user?.displayName || "");
    const [isSaving, setIsSaving] = useState(false);
    const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

    if (loading) {
        return (
            <div className="mx-auto max-w-xl text-center mt-12">
                <p className="text-[var(--muted)]">Loading profile...</p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="mx-auto max-w-xl text-center mt-12">
                <p className="text-[var(--muted)]">Redirecting to login...</p>
            </div>
        );
    }

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!displayName.trim() || displayName.trim() === user.displayName) return;

        setIsSaving(true);
        setStatus(null);

        try {
            const res = await fetch("/api/user/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ displayName: displayName.trim() }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || "Failed to update profile");

            await refreshSession();
            setStatus({ type: "success", text: "Profile updated successfully." });
        } catch (err) {
            setStatus({
                type: "error",
                text: err instanceof Error ? err.message : "An error occurred",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        router.push("/login");
    };

    return (
        <div className="mx-auto max-w-xl mt-8">
            <h1 className="text-3xl font-bold mb-8">Your Profile</h1>

            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Account Details</h2>

                <div className="mb-6 flex items-center gap-4">
                    <div className="h-16 w-16 shrink-0 rounded-full bg-brand-500/20 flex items-center justify-center text-xl font-bold text-brand-300">
                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() ?? "?"}
                    </div>
                    <div>
                        <div className="text-sm text-[var(--muted)]">Email Address</div>
                        <div className="font-medium text-lg">{user.email || "No email (Legacy Account)"}</div>
                    </div>
                </div>

                <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
                    <div>
                        <label htmlFor="displayName" className="block text-sm font-medium mb-1">
                            Display Name
                        </label>
                        <input
                            id="displayName"
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="w-full max-w-md rounded-md border border-[var(--card-border)] bg-transparent px-3 py-2 text-sm placeholder-[var(--muted)] outline-none focus:border-brand-500"
                            maxLength={100}
                        />
                    </div>

                    {status && (
                        <div className={`text-sm p-3 rounded-md w-full max-w-md ${status.type === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-500"}`}>
                            {status.text}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={isSaving || displayName.trim() === user.displayName || !displayName.trim()}
                            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
                        >
                            {isSaving ? "Saving..." : "Save Changes"}
                        </button>
                    </div>
                </form>
            </div>

            <div className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-6 mb-6">
                <h2 className="text-xl font-semibold mb-4">Data & Sync</h2>
                <p className="text-sm text-[var(--muted)] mb-4">
                    Manage your progress, learning events, and cross-device sync settings on the Progress page.
                </p>
                <Link href="/progress" className="inline-block rounded-md border border-brand-500/30 px-4 py-2 text-sm font-medium text-brand-400 hover:bg-brand-500/10 transition-colors">
                    Go to Progress Settings
                </Link>
            </div>

            <div className="flex justify-end border-t border-[var(--card-border)] pt-6 mt-6">
                <button
                    onClick={handleSignOut}
                    className="rounded-md px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
                >
                    Sign Out
                </button>
            </div>
        </div>
    );
}
