import { z } from "zod";

// Prisma maps MongoDB `_id` values to 24-character hexadecimal strings.  The
// previous CUID validators rejected every real MongoDB record identifier.
export const mongoId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record id.");

const username = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters.")
  .max(30, "Username must be at most 30 characters.")
  .regex(/^[a-zA-Z0-9_]+$/, "Use letters, numbers and underscores only.");

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  username,
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
  profession: z.enum(["STUDENT", "TEACHER", "AUTHORITY", "ADMINISTRATION", "HR", "RESIDENT"]),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your email."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  bio: z.string().trim().max(500).nullable().optional(),
  college: z.string().trim().max(120).nullable().optional(),
  campus: z.string().trim().max(120).nullable().optional(),
  course: z.string().trim().max(120).nullable().optional(),
  interests: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  profession: z.enum(["STUDENT", "TEACHER", "AUTHORITY", "ADMINISTRATION", "HR", "RESIDENT"]).optional(),
});

export const questionSchema = z.object({
  title: z.string().trim().min(12, "A question title needs at least 12 characters.").max(220),
  body: z.string().trim().min(20, "Add a little more context (20 characters minimum).").max(15000),
  topicIds: z.array(mongoId).min(1, "Choose at least one topic.").max(5),
});

export const questionUpdateSchema = questionSchema.partial().refine((value) => Object.keys(value).length > 0, "No changes submitted.");

export const answerSchema = z.object({ body: z.string().trim().min(20).max(15000) });
export const commentSchema = z.object({
  body: z.string().trim().min(2).max(2000),
  parentId: mongoId.optional(),
});
export const topicSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).optional(),
});
export const reportSchema = z.object({
  questionId: mongoId.optional(),
  answerId: mongoId.optional(),
  commentId: mongoId.optional(),
  reason: z.string().trim().min(10).max(1000),
}).refine((value) => Number(Boolean(value.questionId)) + Number(Boolean(value.answerId)) + Number(Boolean(value.commentId)) === 1, {
  message: "Report exactly one piece of content.",
});

export const searchSchema = z.object({
  q: z.string().trim().min(1).max(100),
  type: z.enum(["all", "questions", "answers", "users", "topics"]).default("all"),
});

export const serviceRequestSchema = z.object({
  title: z.string().trim().min(6).max(160),
  description: z.string().trim().min(15).max(5000),
  category: z.enum(["MAINTENANCE", "HOSTEL", "TRANSPORT", "IT", "ACADEMIC", "OTHER"]),
  location: z.string().trim().max(160).optional(),
});

export const campusEventSchema = z.object({
  title: z.string().trim().min(6).max(180),
  description: z.string().trim().min(15).max(5000),
  location: z.string().trim().min(2).max(180),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date().optional().nullable(),
  capacity: z.number().int().min(1).max(100000).optional().nullable(),
  kind: z.enum(["WORKSHOP", "FEST", "SPORTS", "CAREER", "CULTURAL", "CLUB", "OTHER"]),
  coverColor: z.enum(["violet", "coral", "mint", "yellow", "indigo"]).default("violet"),
}).refine((input) => !input.endsAt || input.endsAt > input.startsAt, { message: "End time must be after the start time.", path: ["endsAt"] });

export const careerOpportunitySchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  companyIndustry: z.string().trim().min(2).max(120),
  companyLocation: z.string().trim().min(2).max(120),
  companyWebsite: z.string().trim().url().max(300).optional().or(z.literal("")),
  title: z.string().trim().min(4).max(180),
  location: z.string().trim().min(2).max(160),
  employmentType: z.enum(["INTERNSHIP", "FULL_TIME", "PART_TIME", "APPRENTICESHIP"]),
  stipend: z.string().trim().max(120).optional().or(z.literal("")),
  description: z.string().trim().min(30).max(5000),
  skills: z.array(z.string().trim().min(1).max(50)).min(1).max(12),
  applicationUrl: z.string().trim().url().max(300).optional().or(z.literal("")),
  deadline: z.coerce.date().optional().nullable(),
});

export const newsletterSubscriptionSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(254).transform((email) => email.toLowerCase()),
  interests: z.array(z.enum(["EDUCATION", "ECONOMY", "ENGINEERING", "TECHNOLOGY", "CAREERS", "SCHOLARSHIPS"])).max(6).default(["EDUCATION", "TECHNOLOGY", "CAREERS"]),
});

export const learningProgressSchema = z.object({
  completedMilestones: z.array(z.string().regex(/^[a-f0-9]{24}$/)).max(100),
}).strict();

export const companyReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(8).max(160),
  pros: z.string().trim().min(15).max(5000),
  cons: z.string().trim().max(5000).optional(),
  role: z.string().trim().max(120).optional(),
  isAnonymous: z.boolean().optional(),
});

export const collegeSchema = z.object({
  name: z.string().trim().min(3, "College name must be at least 3 characters.").max(160),
  city: z.string().trim().min(2, "Add the city where the college is located.").max(100),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().min(2).max(100).optional(),
  type: z.enum(["COLLEGE", "HOSTEL", "CAMPUS", "SOCIETY", "APARTMENT", "INSTITUTE", "SCHOOL", "OTHER", "UNIVERSITY"]).optional(),
  website: z.string().trim().url("Add a valid website URL.").max(300).optional().or(z.literal("")),
  description: z.string().trim().min(20, "Add a short description (20 characters minimum).").max(1200).optional().or(z.literal("")),
  aisheCode: z.string().trim().regex(/^[A-Z]-\d+$/i, "Invalid AISHE institution code.").max(20).optional().or(z.literal("")),
  coverColor: z.enum(["indigo", "violet", "mint", "coral", "yellow"]).optional(),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  buildingCount: z.number().int().min(1).max(10000).optional().nullable(),
  residentLabel: z.string().trim().max(40).optional().or(z.literal("")),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  departmentSlugs: z.array(z.string().trim().regex(/^[a-z0-9-]+$/).max(72)).max(12).optional().default([]),
});

export const adminCollegeCreateSchema = collegeSchema.extend({ verified: z.boolean().optional() });
export const adminCollegeUpdateSchema = collegeSchema.partial().extend({
  verified: z.boolean().optional(),
}).strict().refine((input) => Object.keys(input).length > 0, "No college changes submitted.");

export const collegeDepartmentsSchema = z.object({
  departmentSlugs: z.array(z.string().trim().regex(/^[a-z0-9-]+$/).max(72)).max(12),
}).strict();

export const collegeMembershipSchema = z.object({
  course: z.string().trim().max(120).optional().or(z.literal("")),
  graduationYear: z.number().int().min(2000).max(2100).optional().nullable(),
});

export const communityIssueSchema = z.object({
  title: z.string().trim().min(6).max(180),
  description: z.string().trim().min(15).max(5000),
  category: z.enum(["WATER", "ELECTRICITY", "CLEANLINESS", "SAFETY", "NOISE", "MAINTENANCE", "TRANSPORT", "OTHER"]),
  severity: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  location: z.string().trim().max(180).optional().or(z.literal("")),
});

export const marketSchema = z.object({
  name: z.string().trim().min(2).max(160),
  category: z.enum(["MARKET", "GROCERY", "GREENGROCER", "SUPERMARKET", "MARKETPLACE"]).default("MARKET"),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

export const produceSchema = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.enum(["VEGETABLE", "FRUIT", "GROCERY", "OTHER"]),
  availability: z.enum(["IN_STOCK", "LIMITED", "OUT_OF_STOCK"]).default("IN_STOCK"),
  priceNote: z.string().trim().max(100).optional().or(z.literal("")),
});

export const placeLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  address: z.string().trim().max(300).optional().or(z.literal("")),
});
