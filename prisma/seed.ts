import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const day = (offset: number, hour: number) => { const value = new Date(); value.setDate(value.getDate() + offset); value.setHours(hour, 0, 0, 0); return value; };

async function main() {
  const demo = await prisma.user.upsert({
    where: { email: "meera@broincampus.dev" },
    update: {},
    create: { name: "Meera Nair", username: "meera_nair", email: "meera@broincampus.dev", passwordHash: await bcrypt.hash("Campus123!", 12), profile: { create: { campus: "North Campus", course: "Computer Science" } } },
  });
  await prisma.profile.upsert({ where: { userId: demo.id }, create: { userId: demo.id, campus: "North Campus", course: "Computer Science" }, update: { college: null } });
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
