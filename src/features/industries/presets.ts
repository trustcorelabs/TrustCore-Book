export const businessTypes = [
  "GENERAL",
  "SALON",
  "BARBER",
  "SPA",
  "NAIL_LASH",
  "BRIDAL",
  "FITNESS",
  "TUTORING",
  "PHOTOGRAPHY",
] as const;
export type BusinessType = (typeof businessTypes)[number];
export type Vocabulary = {
  team: string;
  provider: string;
  services: string;
  service: string;
  customers: string;
  customer: string;
};
export const standardVocabulary: Vocabulary = {
  team: "Staff",
  provider: "Staff member",
  services: "Services",
  service: "Service",
  customers: "Customers",
  customer: "Customer",
};
const clientVocabulary: Vocabulary = {
  ...standardVocabulary,
  team: "Team",
  provider: "Professional",
  customers: "Clients",
  customer: "Client",
};
type Preset = {
  label: string;
  vocabulary: Vocabulary;
  suggestions: readonly string[];
  guidance: string;
};
export const industryPresets: Record<BusinessType, Preset> = {
  GENERAL: {
    label: "Other appointment-based business",
    vocabulary: standardVocabulary,
    suggestions: ["Consultation", "Individual appointment"],
    guidance:
      "Start with one service, its duration and price. Add a provider and working hours.",
  },
  SALON: {
    label: "Beauty salon",
    vocabulary: clientVocabulary,
    suggestions: ["Haircut & finish", "Colour consultation", "Blow dry"],
    guidance:
      "Set service durations, assign qualified professionals and allow time for preparation and clean-up.",
  },
  BARBER: {
    label: "Barber shop",
    vocabulary: { ...clientVocabulary, provider: "Barber" },
    suggestions: ["Haircut", "Beard trim", "Cut & beard"],
    guidance:
      "Add individual appointments, assign barbers and set a buffer between visits where needed.",
  },
  SPA: {
    label: "Spa & wellness studio",
    vocabulary: { ...clientVocabulary, provider: "Practitioner" },
    suggestions: ["Relaxation massage", "Facial", "Wellness consultation"],
    guidance:
      "Allow preparation and reset time around each appointment. Only provider availability is scheduled; room capacity is not managed.",
  },
  NAIL_LASH: {
    label: "Nail & lash studio",
    vocabulary: { ...clientVocabulary, provider: "Artist" },
    suggestions: ["Manicure", "Lash consultation", "Nail art appointment"],
    guidance:
      "Use categories and optional add-ons to organize your menu. Include preparation time in provider buffers.",
  },
  BRIDAL: {
    label: "Bridal studio",
    vocabulary: { ...clientVocabulary, provider: "Artist" },
    suggestions: ["Bridal consultation", "Makeup trial", "Bridal styling"],
    guidance:
      "Build individual appointments or packages with accurate total durations. Group bookings are not supported.",
  },
  FITNESS: {
    label: "Personal trainer & fitness coach",
    vocabulary: {
      ...clientVocabulary,
      provider: "Coach",
      services: "Sessions",
      service: "Session",
    },
    suggestions: [
      "Personal training",
      "Fitness consultation",
      "Technique session",
    ],
    guidance:
      "Schedule one-to-one sessions and coach availability. Recurring courses and group capacity are not supported.",
  },
  TUTORING: {
    label: "Private tutor & instructor",
    vocabulary: {
      ...clientVocabulary,
      provider: "Instructor",
      services: "Sessions",
      service: "Session",
    },
    suggestions: [
      "Individual lesson",
      "Introductory session",
      "Exam preparation",
    ],
    guidance:
      "Set up individual lessons with a duration, price and instructor. Recurring courses and group bookings are not supported.",
  },
  PHOTOGRAPHY: {
    label: "Photography studio",
    vocabulary: {
      ...clientVocabulary,
      provider: "Photographer",
      services: "Sessions",
      service: "Session",
    },
    suggestions: [
      "Portrait session",
      "Headshot session",
      "Planning consultation",
    ],
    guidance:
      "Include setup and pack-down buffers. The calendar manages photographers; shared equipment and rooms need separate coordination.",
  },
};
export function industryPreset(type?: string | null): Preset {
  return industryPresets[businessTypes.find((id) => id === type) ?? "GENERAL"];
}
export function vocabularyFor(business?: {
  businessType?: string | null;
  terminologyMode?: string | null;
}): Vocabulary {
  return business?.terminologyMode === "INDUSTRY"
    ? industryPreset(business.businessType).vocabulary
    : standardVocabulary;
}
