import { describe, expect, it } from "vitest";
import {
  businessTypes,
  industryPreset,
  vocabularyFor,
  standardVocabulary,
} from "@/features/industries/presets";
import { businessSchema } from "@/lib/validation";
const base = {
  name: "Example business",
  slug: "example-business",
  country: "LK",
  timezone: "Asia/Colombo",
};
describe("industry preferences", () => {
  it.each(businessTypes)(
    "validates %s without adding catalog records",
    (businessType) => {
      const input = businessSchema.parse({
        ...base,
        businessType,
        terminologyMode: "INDUSTRY",
      });
      expect(input.businessType).toBe(businessType);
      expect(input).not.toHaveProperty("services");
      expect(industryPreset(businessType).suggestions.length).toBeGreaterThan(
        0,
      );
    },
  );
  it("keeps existing clients compatible and rejects unknown persisted preferences", () => {
    expect(businessSchema.safeParse(base).success).toBe(true);
    expect(
      businessSchema.safeParse({ ...base, businessType: "HEALTHCARE" }).success,
    ).toBe(false);
    expect(
      businessSchema.safeParse({ ...base, terminologyMode: "anything" })
        .success,
    ).toBe(false);
    expect(vocabularyFor()).toEqual(standardVocabulary);
    expect(
      vocabularyFor({ businessType: "FITNESS", terminologyMode: "STANDARD" }),
    ).toEqual(standardVocabulary);
    expect(industryPreset("__proto__")).toEqual(industryPreset("GENERAL"));
  });
  it("adapts terminology without changing canonical service/customer routes", () => {
    expect(
      vocabularyFor({ businessType: "TUTORING", terminologyMode: "INDUSTRY" }),
    ).toMatchObject({
      services: "Sessions",
      provider: "Instructor",
      customers: "Clients",
    });
    expect(
      vocabularyFor({ businessType: "BARBER", terminologyMode: "INDUSTRY" })
        .provider,
    ).toBe("Barber");
  });
});
