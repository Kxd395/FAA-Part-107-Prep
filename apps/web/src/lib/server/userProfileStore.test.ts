import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getUserProfileById, getUserProfileByEmail, findOrCreateUserByEmail, updateUserProfile, clearUserProfileStoreForTests } from "./userProfileStore";
import fs from "fs/promises";

const fsMock = vi.hoisted(() => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
}));

// Mock the fs module so we don't write to disk during tests
vi.mock("fs/promises", () => ({
    ...fsMock,
    default: fsMock,
}));

describe("userProfileStore.ts", () => {

    beforeEach(async () => {
        vi.clearAllMocks();
        await clearUserProfileStoreForTests();
        // Simulate empty file
        vi.mocked(fs.readFile).mockResolvedValue("{}");
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("should create and retrieve a user profile by email and ID", async () => {
        const { profile, created } = await findOrCreateUserByEmail("test@example.com");

        expect(profile).toBeDefined();
        expect(created).toBe(true);
        expect(profile.id).toBeDefined();
        expect(profile.email).toBe("test@example.com");
        expect(profile.displayName).toBe("test"); // Defaults to email username

        const byId = await getUserProfileById(profile.id);
        expect(byId).toEqual(profile);

        const byEmail = await getUserProfileByEmail("test@example.com");
        expect(byEmail).toEqual(profile);
    });

    it("should update an existing profile by ID", async () => {
        const { profile } = await findOrCreateUserByEmail("update@example.com");

        const updated = await updateUserProfile(profile.id, {
            displayName: "New Display Name",
        });

        expect(updated).toBeTruthy();
        if (!updated) return;
        expect(updated.id).toBe(profile.id);
        expect(updated.email).toBe("update@example.com");
        expect(updated.displayName).toBe("New Display Name");

        const fetched = await getUserProfileById(profile.id);
        expect(fetched).toEqual(updated);
    });

    it("should return null for non-existent profiles", async () => {
        expect(await getUserProfileById("nope")).toBeNull();
        expect(await getUserProfileByEmail("nope@example.com")).toBeNull();
    });
});
