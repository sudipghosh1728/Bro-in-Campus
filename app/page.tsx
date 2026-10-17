import Link from "next/link";
import Script from "next/script";
import { ArrowRight, BrainCircuit, Building2, MessageCircleQuestion, Sparkles } from "lucide-react";
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
      <Script id="bro-in-campus-website-schema" type="application/ld+json">{JSON.stringify({ "@context": "https://schema.org", "@type": "WebSite", name: "Bro in Campus", url: "https://broincampus.in", description: "India's student community for campuses, roadmaps, scholarships and opportunities." })}</Script>
      <section className="home-welcome"><div><p className="section-kicker"><Sparkles size={15} /> India’s student community</p><h1>Your campus.<br /><em>Your next move.</em></h1><p>Find your people, make campus life easier, discover student opportunities and turn your department into a learning plan with momentum.</p><div><Link className="button button--red" href="/learn">Explore your roadmap <ArrowRight size={17} /></Link><Link className="text-link" href="/colleges">Find your campus</Link></div></div><aside><span>In your orbit</span><b>{colleges.colleges.length + students.students.length + community.questions.length}</b><p>signals from campus, community and opportunity</p><div><i /><i /><i /><i /></div></aside></section>
      <section className="home-grid"><Link className="hub-card hub-card--campus" href="/colleges"><span className="hub-icon"><Building2 size={22} /></span><p className="section-kicker">Campus life</p><h2>Every campus<br /><em>has a living map.</em></h2><p>{colleges.colleges[0] ? `${colleges.colleges[0].name} is already in the directory.` : "List your college and begin its shared campus hub."}</p><small>{colleges.colleges.length} campuses listed <ArrowRight size={15} /></small></Link><Link className="hub-card hub-card--career" href="/learn"><span className="hub-icon"><BrainCircuit size={22} /></span><p className="section-kicker">Your direction</p><h2>Learn with intent.<br /><em>Show your work.</em></h2><p>Department-aware roadmaps, skill signals, scholarships and a briefing built for your next decision.</p><small>Explore student growth <ArrowRight size={15} /></small></Link><Link className="hub-card hub-card--community" href="/community"><span className="hub-icon"><MessageCircleQuestion size={22} /></span><p className="section-kicker">Community</p><h2>Ask once.<br /><em>Move together.</em></h2><p>{community.questions[0]?.title ?? "Shared questions and updates will show up here."}</p><small>{community.questions.length} active discussions <ArrowRight size={15} /></small></Link></section>
      <section className="home-bottom"><div><p className="section-kicker">Built for the work between lectures</p><h2>One place to turn student life into momentum.</h2><p>Campus membership, events, opportunities, funding links, shared issues and conversations are backed by live data and actions—not a static brochure.</p></div><div className="home-bottom__stats"><span><b>{community.topics.length}</b> topics to follow</span><span><b>{campus.events.length}</b> campus events</span><span><b>{campus.support.open}</b> support requests tracked</span></div></section>
    </main>;
  } catch (error) {
    // Kept server-side: this makes an unavailable Atlas connection observable in
    // Vercel logs without leaking operational details into the browser.
    console.error("Home data load failed", error);
    return <DatabaseRequired />;
  }
}
