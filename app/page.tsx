import Link from "next/link";
import { ArrowRight, Building2, GraduationCap, MessageCircleQuestion, Sparkles } from "lucide-react";
import { DatabaseRequired } from "@/components/DatabaseRequired";
import { getCurrentUser } from "@/lib/auth";
import { getCampusOverview } from "@/lib/campus";
import { getCollegeDirectory, getStudentDirectory } from "@/lib/colleges";
import { getDiscoverFeed } from "@/lib/community";

export default async function Home() {
  try {
    const user = await getCurrentUser();
    const [campus, colleges, students, community] = await Promise.all([getCampusOverview(user), getCollegeDirectory(user, { take: 3 }), getStudentDirectory(user, { take: 3 }), getDiscoverFeed(user, { sort: "recommended", take: 3 })]);
    return <main className="app-page home-page">
      <section className="home-welcome"><div><p className="section-kicker"><Sparkles size={15} /> A shared-living network</p><h1>Your campus.<br /><em>Your people.</em></h1><p>Bro in Campus makes the practical side of shared living visible: nearby markets, crowd-verified essentials, shared issues and useful conversations for colleges, hostels, campuses and societies.</p><div><Link className="button button--red" href="/colleges">Find your campus <ArrowRight size={17} /></Link><Link className="text-link" href="/community">Join the conversation</Link></div></div><aside><span>Live on Bro</span><b>{colleges.colleges.length + students.students.length + community.questions.length}</b><p>campus, people and community signals</p><div><i /><i /><i /><i /></div></aside></section>
      <section className="home-grid"><Link className="hub-card hub-card--campus" href="/colleges"><span className="hub-icon"><Building2 size={22} /></span><p className="section-kicker">Campus</p><h2>Every shared home<br /><em>has a front door.</em></h2><p>{colleges.colleges[0] ? `${colleges.colleges[0].name} is already in the directory.` : "List your college, hostel or society and start its living hub."}</p><small>{colleges.colleges.length} campuses listed <ArrowRight size={15} /></small></Link><Link className="hub-card hub-card--career" href="/students"><span className="hub-icon"><GraduationCap size={22} /></span><p className="section-kicker">People</p><h2>Find neighbours<br /><em>who understand.</em></h2><p>{students.students[0] ? `${students.students[0].name} is building their local circle.` : "Join a campus to show up in the people directory."}</p><small>{students.students.length} people to know <ArrowRight size={15} /></small></Link><Link className="hub-card hub-card--community" href="/community"><span className="hub-icon"><MessageCircleQuestion size={22} /></span><p className="section-kicker">Community</p><h2>Make one problem<br /><em>visible to all.</em></h2><p>{community.questions[0]?.title ?? "Shared questions and updates will show up here."}</p><small>{community.questions.length} active discussions <ArrowRight size={15} /></small></Link></section>
      <section className="home-bottom"><div><p className="section-kicker">Useful context, not a static case study</p><h2>Designed for the life between rooms.</h2><p>Place membership, local-market distance, community availability reports, shared issues and conversations are backed by live MongoDB data and actions.</p></div><div className="home-bottom__stats"><span><b>{community.topics.length}</b> topics to follow</span><span><b>{campus.events.length}</b> local events</span><span><b>{campus.support.open}</b> requests being tracked</span></div></section>
    </main>;
  } catch { return <DatabaseRequired />; }
}
