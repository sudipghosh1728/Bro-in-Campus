export const Role = { USER: "USER", MODERATOR: "MODERATOR", ADMIN: "ADMIN" } as const;
export type Role = (typeof Role)[keyof typeof Role];

// Profession describes how a person participates in a campus community. It is
// deliberately separate from the platform-wide moderation role above.
export const Profession = { STUDENT: "STUDENT", TEACHER: "TEACHER", AUTHORITY: "AUTHORITY", ADMINISTRATION: "ADMINISTRATION", RESIDENT: "RESIDENT" } as const;
export type Profession = (typeof Profession)[keyof typeof Profession];
export const IssueManagerProfessions = [Profession.TEACHER, Profession.AUTHORITY, Profession.ADMINISTRATION] as const;

export const ContentStatus = { PUBLISHED: "PUBLISHED", HIDDEN: "HIDDEN", DELETED: "DELETED" } as const;
export const NotificationType = {
  ANSWER_CREATED: "ANSWER_CREATED", ANSWER_UPVOTED: "ANSWER_UPVOTED", COMMENT_CREATED: "COMMENT_CREATED",
  COMMENT_REPLIED: "COMMENT_REPLIED", USER_FOLLOWED: "USER_FOLLOWED", ANSWER_ACCEPTED: "ANSWER_ACCEPTED",
  CAMPUS_ISSUE_REPORTED: "CAMPUS_ISSUE_REPORTED", CAMPUS_ISSUE_RESOLVED: "CAMPUS_ISSUE_RESOLVED",
} as const;
export const ReportStatus = { OPEN: "OPEN", REVIEWING: "REVIEWING", RESOLVED: "RESOLVED", DISMISSED: "DISMISSED" } as const;
export const EventRsvpStatus = { GOING: "GOING", WAITLISTED: "WAITLISTED" } as const;
export const OpportunityStatus = { OPEN: "OPEN", CLOSED: "CLOSED" } as const;
export const ServiceRequestStatus = { OPEN: "OPEN", IN_PROGRESS: "IN_PROGRESS", RESOLVED: "RESOLVED", CLOSED: "CLOSED" } as const;
