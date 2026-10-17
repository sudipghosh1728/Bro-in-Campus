import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const day = (offset: number, hour: number) => { const value = new Date(); value.setDate(value.getDate() + offset); value.setHours(hour, 0, 0, 0); return value; };

/**
 * MongoDB deliberately does not enforce foreign keys. If a development user is
 * removed directly in Atlas, its authored documents can outlive it and Prisma
 * will correctly reject those broken required relations. The seed is the
 * development recovery path: preserve authored content under the restored demo
 * account and remove relationship-only records that cannot be safely reassigned.
 */
async function repairOrphanedUserReferences(restoredUserId: string) {
  const [users, questions, answers, comments, reviews, events, serviceRequests, issues, produce, activities, media, notifications, reports, colleges] = await Promise.all([
    prisma.user.findMany({ select: { id: true } }),
    prisma.question.findMany({ select: { authorId: true } }),
    prisma.answer.findMany({ select: { authorId: true } }),
    prisma.comment.findMany({ select: { authorId: true } }),
    prisma.companyReview.findMany({ select: { authorId: true } }),
    prisma.campusEvent.findMany({ select: { createdById: true } }),
    prisma.serviceRequest.findMany({ select: { userId: true } }),
    prisma.communityIssue.findMany({ select: { reporterId: true } }),
    prisma.produceListing.findMany({ select: { reportedById: true } }),
    prisma.activity.findMany({ select: { userId: true } }),
    prisma.media.findMany({ select: { userId: true } }),
    prisma.notification.findMany({ select: { userId: true, actorId: true } }),
    prisma.report.findMany({ select: { reporterId: true } }),
    prisma.college.findMany({ select: { listedById: true } }),
  ]);
  const knownUserIds = new Set(users.map((user) => user.id));
  const referencedIds = [
    ...questions.map((item) => item.authorId), ...answers.map((item) => item.authorId), ...comments.map((item) => item.authorId), ...reviews.map((item) => item.authorId),
    ...events.map((item) => item.createdById), ...serviceRequests.map((item) => item.userId), ...issues.map((item) => item.reporterId), ...produce.map((item) => item.reportedById),
    ...activities.map((item) => item.userId), ...media.map((item) => item.userId), ...notifications.flatMap((item) => [item.userId, item.actorId]), ...reports.map((item) => item.reporterId), ...colleges.map((item) => item.listedById),
  ].filter((value): value is string => Boolean(value));
  const orphanIds = [...new Set(referencedIds.filter((id) => !knownUserIds.has(id)))];
  if (!orphanIds.length) return;

  await Promise.all([
    // Preserve authored content rather than silently losing it.
    prisma.question.updateMany({ where: { authorId: { in: orphanIds } }, data: { authorId: restoredUserId } }),
    prisma.answer.updateMany({ where: { authorId: { in: orphanIds } }, data: { authorId: restoredUserId } }),
    prisma.comment.updateMany({ where: { authorId: { in: orphanIds } }, data: { authorId: restoredUserId } }),
    prisma.companyReview.updateMany({ where: { authorId: { in: orphanIds } }, data: { authorId: restoredUserId } }),
    prisma.campusEvent.updateMany({ where: { createdById: { in: orphanIds } }, data: { createdById: restoredUserId } }),
    prisma.serviceRequest.updateMany({ where: { userId: { in: orphanIds } }, data: { userId: restoredUserId } }),
    prisma.communityIssue.updateMany({ where: { reporterId: { in: orphanIds } }, data: { reporterId: restoredUserId } }),
    prisma.produceListing.updateMany({ where: { reportedById: { in: orphanIds } }, data: { reportedById: restoredUserId } }),
    prisma.activity.updateMany({ where: { userId: { in: orphanIds } }, data: { userId: restoredUserId } }),
    prisma.media.updateMany({ where: { userId: { in: orphanIds } }, data: { userId: restoredUserId } }),
    prisma.notification.updateMany({ where: { userId: { in: orphanIds } }, data: { userId: restoredUserId } }),
    prisma.notification.updateMany({ where: { actorId: { in: orphanIds } }, data: { actorId: restoredUserId } }),
    prisma.report.updateMany({ where: { reporterId: { in: orphanIds } }, data: { reporterId: restoredUserId } }),
    prisma.college.updateMany({ where: { listedById: { in: orphanIds } }, data: { listedById: restoredUserId } }),
    // Relationship records cannot be reassigned without risking unique-key collisions.
    prisma.profile.deleteMany({ where: { userId: { in: orphanIds } } }),
    prisma.session.deleteMany({ where: { userId: { in: orphanIds } } }),
    prisma.passwordResetOtp.deleteMany({ where: { userId: { in: orphanIds } } }),
    prisma.userFollow.deleteMany({ where: { OR: [{ followerId: { in: orphanIds } }, { followingId: { in: orphanIds } }] } }),
    prisma.topicFollow.deleteMany({ where: { userId: { in: orphanIds } } }),
    prisma.answerVote.deleteMany({ where: { userId: { in: orphanIds } } }),
    prisma.questionVote.deleteMany({ where: { userId: { in: orphanIds } } }),
    prisma.bookmark.deleteMany({ where: { userId: { in: orphanIds } } }),
    prisma.eventRsvp.deleteMany({ where: { userId: { in: orphanIds } } }),
    prisma.issueVote.deleteMany({ where: { userId: { in: orphanIds } } }),
    prisma.opportunitySave.deleteMany({ where: { userId: { in: orphanIds } } }),
    prisma.collegeMembership.deleteMany({ where: { userId: { in: orphanIds } } }),
  ]);
}

async function main() {
  const demo = await prisma.user.upsert({
    where: { email: "meera@broincampus.dev" },
    update: {},
    create: { name: "Meera Nair", username: "meera_nair", email: "meera@broincampus.dev", passwordHash: await bcrypt.hash("Campus123!", 12), profile: { create: { campus: "North Campus", course: "Computer Science" } } },
  });
  await prisma.profile.upsert({ where: { userId: demo.id }, create: { userId: demo.id, campus: "North Campus", course: "Computer Science" }, update: { college: null } });
  await repairOrphanedUserReferences(demo.id);
  const departmentDefinitions = [
    { name: "Computing & AI", slug: "computing-ai", synopsis: "Software, data, AI and digital systems.", focusAreas: ["Software", "Data", "AI"], accent: "indigo", demandSignal: 96 },
    { name: "Core Engineering", slug: "core-engineering", synopsis: "Build the physical systems that shape everyday life.", focusAreas: ["Mechanical", "Civil", "Electrical"], accent: "mint", demandSignal: 83 },
    { name: "Business & Commerce", slug: "business-commerce", synopsis: "Markets, operations, entrepreneurship and finance.", focusAreas: ["Finance", "Strategy", "Operations"], accent: "yellow", demandSignal: 81 },
    { name: "Design & Media", slug: "design-media", synopsis: "Craft experiences, narratives and visual systems.", focusAreas: ["Product", "Visual", "Media"], accent: "coral", demandSignal: 77 },
    { name: "Health & Life Sciences", slug: "health-life-sciences", synopsis: "Care, research, biotechnology and public health.", focusAreas: ["Health", "Biotech", "Research"], accent: "mint", demandSignal: 79 },
    { name: "Humanities & Law", slug: "humanities-law", synopsis: "People, institutions, policy and advocacy.", focusAreas: ["Law", "Policy", "Behaviour"], accent: "violet", demandSignal: 72 },
    { name: "Science & Research", slug: "science-research", synopsis: "Investigate systems, evidence and discovery.", focusAreas: ["Maths", "Physics", "Research"], accent: "indigo", demandSignal: 75 },
  ];
  await Promise.all(departmentDefinitions.map((department) => prisma.department.upsert({ where: { slug: department.slug }, update: department, create: department })));
  const learningPathDefinitions = [
    { title: "Applied AI builder", slug: "applied-ai-builder", departmentSlug: "computing-ai", level: "FOUNDATION", duration: "8 weeks", description: "Move from Python fundamentals to a focused AI portfolio project with responsible evaluation built in.", skills: ["Python", "Data", "LLM workflows", "Evaluation"], milestones: [{ title: "Weeks 1–2", outcome: "Set up Python, data handling and clean notebooks." }, { title: "Weeks 3–5", outcome: "Build one useful model or retrieval prototype." }, { title: "Weeks 6–8", outcome: "Publish an evaluated project case study." }], trendScore: 98, featured: true },
    { title: "Full-stack launchpad", slug: "full-stack-launchpad", departmentSlug: "computing-ai", level: "FOUNDATION", duration: "10 weeks", description: "Learn the foundations behind a polished web product and ship something a real student can use.", skills: ["TypeScript", "React", "APIs", "Databases"], milestones: [{ title: "Weeks 1–3", outcome: "Build accessible interface patterns." }, { title: "Weeks 4–7", outcome: "Connect secure APIs and data." }, { title: "Weeks 8–10", outcome: "Deploy, test and document your product." }], trendScore: 94, featured: true },
    { title: "Sustainable systems studio", slug: "sustainable-systems-studio", departmentSlug: "core-engineering", level: "INTERMEDIATE", duration: "7 weeks", description: "Use systems thinking, simulation and field observation to tackle an infrastructure challenge.", skills: ["CAD", "Analysis", "Materials", "Systems thinking"], milestones: [{ title: "Week 1", outcome: "Map a local engineering challenge." }, { title: "Weeks 2–5", outcome: "Prototype and test a measurable intervention." }, { title: "Weeks 6–7", outcome: "Present a technical decision record." }], trendScore: 86, featured: true },
    { title: "Finance & analytics sprint", slug: "finance-analytics-sprint", departmentSlug: "business-commerce", level: "FOUNDATION", duration: "6 weeks", description: "Build data fluency for finance, operations and analyst roles without losing the business context.", skills: ["Excel", "SQL", "Financial modelling", "Storytelling"], milestones: [{ title: "Weeks 1–2", outcome: "Read a business problem through numbers." }, { title: "Weeks 3–4", outcome: "Model a decision in a spreadsheet." }, { title: "Weeks 5–6", outcome: "Communicate an executive recommendation." }], trendScore: 89, featured: true },
    { title: "Product design fieldwork", slug: "product-design-fieldwork", departmentSlug: "design-media", level: "FOUNDATION", duration: "6 weeks", description: "Turn an observed campus friction into a researched, tested and clearly presented product case study.", skills: ["Research", "Figma", "Prototyping", "Writing"], milestones: [{ title: "Week 1", outcome: "Frame one real problem." }, { title: "Weeks 2–4", outcome: "Interview, sketch and test a prototype." }, { title: "Weeks 5–6", outcome: "Build a concise case study." }], trendScore: 88, featured: true },
    { title: "Clinical research literacy", slug: "clinical-research-literacy", departmentSlug: "health-life-sciences", level: "FOUNDATION", duration: "5 weeks", description: "Learn to read evidence critically and communicate a health research question with care.", skills: ["Literature review", "Ethics", "Data literacy", "Communication"], milestones: [{ title: "Week 1", outcome: "Find credible research sources." }, { title: "Weeks 2–3", outcome: "Assess evidence quality and ethics." }, { title: "Weeks 4–5", outcome: "Write a clear evidence brief." }], trendScore: 82, featured: false },
    { title: "Policy & public impact", slug: "policy-public-impact", departmentSlug: "humanities-law", level: "FOUNDATION", duration: "6 weeks", description: "Go from a public problem to a properly sourced, student-friendly policy memo.", skills: ["Research", "Policy", "Argument", "Public speaking"], milestones: [{ title: "Week 1", outcome: "Define who is affected." }, { title: "Weeks 2–4", outcome: "Evaluate evidence and policy options." }, { title: "Weeks 5–6", outcome: "Present an actionable memo." }], trendScore: 78, featured: false },
    { title: "Research problem lab", slug: "research-problem-lab", departmentSlug: "science-research", level: "INTERMEDIATE", duration: "8 weeks", description: "Develop a research habit from question framing through reproducible analysis and a poster.", skills: ["Methods", "Statistics", "Reproducibility", "Writing"], milestones: [{ title: "Weeks 1–2", outcome: "Frame a measurable research question." }, { title: "Weeks 3–6", outcome: "Analyse evidence transparently." }, { title: "Weeks 7–8", outcome: "Create a clear research poster." }], trendScore: 80, featured: false },
  ];
  await Promise.all(learningPathDefinitions.map((path) => prisma.learningPath.upsert({ where: { slug: path.slug }, update: path, create: path })));
  const scholarshipDefinitions = [
    { title: "National Scholarship Portal programmes", slug: "national-scholarship-portal-programmes", provider: "National Scholarship Portal", description: "A single official entry point for eligible central and state scholarship schemes.", amount: null, eligibility: "Eligibility, documents and dates differ by scheme. Review the current official notice before applying.", categories: ["MERIT", "NEED_BASED", "STATE"], applicationUrl: "https://scholarships.gov.in/", deadline: null, featured: true },
    { title: "AICTE student development schemes", slug: "aicte-student-development-schemes", provider: "All India Council for Technical Education", description: "Official scheme information for eligible students in AICTE-approved technical education pathways.", amount: null, eligibility: "Check the current AICTE notice for institution, year and income requirements.", categories: ["ENGINEERING", "TECHNICAL"], applicationUrl: "https://www.aicte-india.org/schemes/students-development-schemes", deadline: null, featured: true },
    { title: "University Grants Commission opportunities", slug: "ugc-student-opportunities", provider: "University Grants Commission", description: "Official notices and fellowships relevant to higher education and research.", amount: null, eligibility: "Review the current UGC notification and your institution's guidance before submitting documents.", categories: ["RESEARCH", "POSTGRADUATE"], applicationUrl: "https://www.ugc.gov.in/", deadline: null, featured: true },
    { title: "State education support finder", slug: "state-education-support-finder", provider: "State education departments", description: "Start with your state government education portal for concession and support announcements.", amount: null, eligibility: "Requirements vary by state, category, course and institution. Confirm with the issuing authority.", categories: ["STATE", "CONCESSION"], applicationUrl: null, deadline: null, featured: false },
  ];
  await Promise.all(scholarshipDefinitions.map((scholarship) => prisma.scholarship.upsert({ where: { slug: scholarship.slug }, update: scholarship, create: scholarship })));
  const briefingDefinitions = [
    { title: "Build a portfolio around evidence, not just certificates", slug: "portfolio-evidence-over-certificates", summary: "Use one tangible project, a concise decision log and a short reflection to show what you can actually do.", category: "CAREERS", sourceName: "Bro in Campus field note", sourceUrl: null, publishedAt: day(-1, 9), featured: true },
    { title: "AI literacy now includes evaluation and responsible use", slug: "ai-literacy-evaluation-responsible-use", summary: "The strongest student projects explain where a tool helps, how results were checked and what limits remain.", category: "TECHNOLOGY", sourceName: "IndiaAI", sourceUrl: "https://indiaai.gov.in/", publishedAt: day(-2, 9), featured: true },
    { title: "Treat scholarship research as a repeatable weekly practice", slug: "scholarship-research-weekly-practice", summary: "Maintain a document folder, save official links and review deadlines weekly instead of discovering funding at the last minute.", category: "SCHOLARSHIPS", sourceName: "National Scholarship Portal", sourceUrl: "https://scholarships.gov.in/", publishedAt: day(-3, 9), featured: true },
    { title: "The student edge in a changing economy is adaptable proof of work", slug: "adaptable-proof-of-work", summary: "Combine core subject knowledge, communication and a small body of visible work that makes your next step easy to understand.", category: "ECONOMY", sourceName: "Bro in Campus field note", sourceUrl: null, publishedAt: day(-4, 9), featured: false },
    { title: "Research habits make any department more future-ready", slug: "research-habits-future-ready", summary: "A clear question, good sources and careful notes are durable skills from laboratory work to law, product and policy.", category: "EDUCATION", sourceName: "Bro in Campus field note", sourceUrl: null, publishedAt: day(-5, 9), featured: false },
  ];
  await Promise.all(briefingDefinitions.map((briefing) => prisma.newsBriefing.upsert({ where: { slug: briefing.slug }, update: briefing, create: briefing })));
  const topicDefinitions = [
    ["Placements", "Placement preparation, companies and interviews."], ["Internships", "Internship search and work experience."], ["Academics", "Courses, faculty and study strategies."], ["Hostel life", "Everyday hostel advice and updates."], ["Clubs & events", "Student clubs, fests and campus events."], ["Campus help", "Services, transport and getting things fixed."],
  ];
  const topics = await Promise.all(topicDefinitions.map(([name, description]) => prisma.topic.upsert({ where: { name }, update: { description }, create: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""), description } })));
  const companies = await Promise.all([
    ["Figma", "Design software", "Remote / Bengaluru", "violet", "A collaborative design company with a student-friendly product and engineering culture."],
    ["Razorpay", "Financial technology", "Bengaluru", "indigo", "A fintech platform offering fast-moving roles across engineering, product and design."],
    ["Swiggy", "Consumer internet", "Bengaluru", "orange", "A consumer technology company with opportunities across operations, design and data."],
  ].map(([name, industry, location, logoColor, description]) => prisma.company.upsert({
    where: { name },
    update: { industry, location, logoColor, description },
    create: { name, slug: name.toLowerCase(), industry, location, logoColor, description, website: `https://${name.toLowerCase()}.com` },
  })));
  if (await prisma.companyReview.count() === 0) await prisma.companyReview.createMany({ data: [
    { companyId: companies[0].id, authorId: demo.id, rating: 5, title: "Thoughtful mentorship and strong design feedback", pros: "The review culture was direct but kind, and I had real ownership over an onboarding improvement.", cons: "The pace can feel intense when launch dates are close.", role: "Product design intern" },
    { companyId: companies[1].id, authorId: demo.id, rating: 4, title: "A fast place to learn product thinking", pros: "Great exposure to customer problems and engineers who explain the why behind their decisions.", cons: "You need to be comfortable taking initiative early.", role: "Product intern", isAnonymous: true },
  ] });
  const opportunityDefinitions = [
    { companyId: companies[0].id, title: "Product Design Intern", location: "Remote / Bengaluru", employmentType: "INTERNSHIP", stipend: "₹45k / month", description: "Work with a product team on a focused design problem.", skills: ["Figma", "UX research", "Prototyping"], applicationUrl: "https://www.figma.com/careers", deadline: day(18, 18) },
    { companyId: companies[1].id, title: "Software Engineering Intern", location: "Bengaluru", employmentType: "INTERNSHIP", stipend: "₹50k / month", description: "Build services and interfaces used by millions of merchants.", skills: ["TypeScript", "React", "SQL"], applicationUrl: "https://razorpay.com/jobs", deadline: day(12, 18) },
    { companyId: companies[2].id, title: "Associate Product Analyst", location: "Bengaluru", employmentType: "FULL_TIME", stipend: "₹14–18 LPA", description: "Use customer and product data to guide experiments and decisions.", skills: ["Analytics", "SQL", "Communication"], applicationUrl: "https://careers.swiggy.com", deadline: day(25, 18) },
  ];
  await Promise.all(opportunityDefinitions.map(async (opportunity) => {
    const existing = await prisma.careerOpportunity.findFirst({ where: { companyId: opportunity.companyId, title: opportunity.title }, select: { id: true } });
    return existing ? prisma.careerOpportunity.update({ where: { id: existing.id }, data: opportunity }) : prisma.careerOpportunity.create({ data: opportunity });
  }));
  const eventDefinitions = [
    { title: "Design systems workshop", description: "Hands-on workshop with the design club.", location: "Innovation Lab", startsAt: day(2, 16), endsAt: day(2, 18), capacity: 80, kind: "WORKSHOP", coverColor: "violet", createdById: demo.id },
    { title: "Inter-hostel football finals", description: "The final match under the lights.", location: "Main Sports Ground", startsAt: day(4, 18), endsAt: null, capacity: 350, kind: "SPORTS", coverColor: "mint", createdById: demo.id },
    { title: "Placement alumni AMA", description: "Ask alumni what they learned during recruitment.", location: "Seminar Hall A", startsAt: day(7, 17), endsAt: null, capacity: 120, kind: "CAREER", coverColor: "coral", createdById: demo.id },
  ];
  await Promise.all(eventDefinitions.map(async (event) => {
    const existing = await prisma.campusEvent.findFirst({ where: { title: event.title }, select: { id: true } });
    return existing ? prisma.campusEvent.update({ where: { id: existing.id }, data: event }) : prisma.campusEvent.create({ data: event });
  }));
  if (await prisma.question.count() === 0) {
    const questions = await Promise.all([
      prisma.question.create({ data: { title: "How should I structure my final placement preparation?", slug: "how-should-i-structure-my-final-placement-preparation", body: "I am starting my final placement preparation and want a realistic weekly plan for DSA, projects and mock interviews.", authorId: demo.id, topics: { create: [{ topicId: topics[0].id }, { topicId: topics[1].id }] } } }),
      prisma.question.create({ data: { title: "Which campus clubs are welcoming to first-year students?", slug: "which-campus-clubs-are-welcoming-to-first-year-students", body: "I want to meet people and contribute, but I am not sure which clubs are beginner-friendly this semester.", authorId: demo.id, topics: { create: [{ topicId: topics[4].id }] } } }),
    ]);
    await prisma.answer.create({ data: { questionId: questions[0].id, authorId: demo.id, body: "Start with two focused DSA sessions each week, reserve one evening for your project portfolio, and do one timed mock interview every Sunday. Track gaps after every mock instead of collecting more resources." } });
  }
}

main().then(() => prisma.$disconnect()).catch(async (error) => { console.error(error); await prisma.$disconnect(); process.exit(1); });
