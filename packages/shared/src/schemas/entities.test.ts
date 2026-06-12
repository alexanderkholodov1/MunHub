import { describe, it, expect } from "vitest";
import { StationSchema } from "./station.js";
import { DetectorSchema } from "./detector.js";
import { UserSchema } from "./user.js";
import { SessionSchema } from "./session.js";

describe("StationSchema", () => {
  const valid = {
    id: "st_1",
    name: "USFQ Rooftop",
    ownerUid: "u_1",
    visibility: "public",
    latitude: -0.196,
    longitude: -78.435,
    altitudeM: 2850,
    city: "Quito",
    country: "EC",
    placement: "rooftop",
    type: "single",
    timezone: "America/Guayaquil",
  };

  it("parses a valid station and applies defaults", () => {
    const s = StationSchema.parse(valid);
    expect(s.institutionId).toBeNull();
    expect(s.shares).toEqual([]);
  });

  it("requires visibility (no default)", () => {
    const { visibility, ...withoutVisibility } = valid;
    void visibility;
    expect(StationSchema.safeParse(withoutVisibility).success).toBe(false);
  });

  it("rejects out-of-range latitude", () => {
    expect(StationSchema.safeParse({ ...valid, latitude: 120 }).success).toBe(false);
  });
});

describe("DetectorSchema", () => {
  it("defaults sipmCount and status", () => {
    const d = DetectorSchema.parse({
      id: "d_1",
      stationId: "st_1",
      deviceToken: "tok_abc",
      hardwareModel: "CosmicWatch v3X",
      firmwareVersion: "MuNRa-1.0",
      hwVersion: "v3X",
    });
    expect(d.sipmCount).toBe(1);
    expect(d.status).toBe("active");
  });
});

describe("UserSchema", () => {
  it("rejects an invalid username", () => {
    const base = {
      uid: "u_1",
      email: "a@b.com",
      displayName: "A",
      role: "user",
    };
    expect(UserSchema.safeParse({ ...base, username: "Has Spaces" }).success).toBe(false);
    expect(UserSchema.safeParse({ ...base, username: "alex_k" }).success).toBe(true);
  });
});

describe("SessionSchema", () => {
  it("rejects endedAt before startedAt", () => {
    expect(
      SessionSchema.safeParse({ id: "s1", detectorId: "d1", startedAt: 100, endedAt: 50 }).success,
    ).toBe(false);
  });
});
