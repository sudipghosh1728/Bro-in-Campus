import Link from "next/link";
import { DatabaseZap } from "lucide-react";

export function DatabaseRequired() {
  return <main className="setup-screen"><div><DatabaseZap size={35} /><p className="section-kicker">Database connection required</p><h1>Connect the platform to MongoDB.</h1><p>Bro in Campus uses a live MongoDB server for its community, campus, and careers data. Add your MongoDB Atlas connection string as <code>DATABASE_URL</code>, then create the indexes and seed the platform.</p><pre>Copy-Item .env.example .env{`\n`}# add your MongoDB Atlas DATABASE_URL to .env{`\n`}npm run db:push{`\n`}npm run db:seed</pre><Link href="/login" className="button button--dark">Open sign in</Link></div></main>;
}
