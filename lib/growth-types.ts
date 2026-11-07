export const academicPlaceTypes = ["COLLEGE", "UNIVERSITY", "INSTITUTE", "SCHOOL", "CAMPUS"];

export type DepartmentOption = {
  id: string;
  name: string;
  slug: string;
  focusAreas: string[];
  accent: string;
};

export type LearningMilestone = { id: string; title: string; outcome: string };

export type LearningProgress = {
  completedMilestones: string[];
  progress: number;
  startedAt: string;
  completedAt: string | null;
};

export type LearningPathCard = {
  id: string;
  title: string;
  slug: string;
  departmentSlug: string;
  level: string;
  duration: string;
  description: string;
  skills: string[];
  milestones: LearningMilestone[];
  fitScore: number;
  progress: LearningProgress | null;
};
