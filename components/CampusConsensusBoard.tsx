"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BriefcaseBusiness, Check, ExternalLink, MapPin, Navigation, Plus, UsersRound, Vote, X } from "lucide-react";
import { api } from "@/lib/client-api";
import { subscribeToRefresh } from "@/lib/live-refresh";
import type { CampusDecisionSummary, CampusProposalInput, ConsensusBoard, PlacementProposal } from "@/lib/consensus-types";

const statusLabels = { EXPECTED: "Expected", ANNOUNCED: "Notice reported", COMPLETED: "Completed", CANCELLED: "Cancelled" };

export function CampusConsensusBoard({ collegeId, initialData, joined, onLocation }: {
  collegeId: string; initialData: ConsensusBoard; joined: boolean;
  onLocation: (location: ConsensusBoard["location"]) => void;
}) {
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState<"LOCATION" | "PLACEMENT">("LOCATION");
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [location, setLocation] = useState({ latitude: "", longitude: "", address: "" });
  const [placement, setPlacement] = useState<Omit<PlacementProposal, "kind">>({ company: "", academicYear: "", status: "EXPECTED", departments: "", eligibility: "", sourceUrl: "" });
  const endpoint = `/api/colleges/${collegeId}/reviews`;
  const accept = useCallback((next: ConsensusBoard) => { setData(next); onLocation(next.location); }, [onLocation]);
  useEffect(() => subscribeToRefresh(async () => {
    accept(await api<ConsensusBoard>(endpoint));
  }), [accept, endpoint]);

  async function vote(decision: CampusDecisionSummary, proposalId: string | null) {
    setPending(true); setError(""); setNotice("");
    try {
      accept(await api<ConsensusBoard>(endpoint, { method: "PUT", body: JSON.stringify({ decisionId: decision.id, proposalId }) }));
      setNotice(proposalId ? "Your vote is saved. The tally and majority result are up to date." : "Your vote has been withdrawn.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save your vote."); }
    finally { setPending(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setPending(true); setError(""); setNotice("");
    const input: CampusProposalInput = tab === "LOCATION"
      ? { kind: "LOCATION", latitude: Number(location.latitude), longitude: Number(location.longitude), address: location.address }
      : { kind: "PLACEMENT", ...placement };
    try {
      accept(await api<ConsensusBoard>(endpoint, { method: "POST", body: JSON.stringify(input) }));
      setFormOpen(false); setNotice("Proposal saved with your vote. Other members can support it or submit an alternative.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not submit this proposal."); }
    finally { setPending(false); }
  }

  function locate() {
    if (!navigator.geolocation) { setError("Your browser does not support device location. Enter the campus coordinates instead."); return; }
    setPending(true); setError("");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocation((current) => ({ ...current, latitude: coords.latitude.toFixed(4), longitude: coords.longitude.toFixed(4) }));
      setPending(false);
    }, () => { setError("Location access was unavailable. You can enter the coordinates manually."); setPending(false); }, { timeout: 10000, enableHighAccuracy: true });
  }

  return <section id="campus-reviews" className="consensus-board" aria-labelledby="campus-reviews-title">
    <header><div><p className="section-kicker"><Vote size={15} /> Made reliable, together</p><h2 id="campus-reviews-title">The campus consensus</h2></div><span className="consensus-seal"><UsersRound size={16} /> One member. One vote.</span></header>
    <p className="consensus-explainer">Choose the information you can support. A proposal needs more than 50% of votes and at least 3 voters in the review. A tie keeps the last agreed result. Votes are not an official verification.</p>
    <div className="consensus-tabs" role="group" aria-label="Campus review category">
      <button aria-pressed={tab === "LOCATION"} onClick={() => { setTab("LOCATION"); setFormOpen(false); setError(""); }}><MapPin size={16} /> Campus location</button>
      <button aria-pressed={tab === "PLACEMENT"} onClick={() => { setTab("PLACEMENT"); setFormOpen(false); setError(""); }}><BriefcaseBusiness size={16} /> Placement reports</button>
    </div>
    <div className="consensus-review-list">
      {data.decisions.filter((decision) => decision.kind === tab).map((decision) => <article className="consensus-review" key={decision.id}>
        <div className="consensus-review-heading"><div><h3>{decision.title}</h3><small>{decision.totalVotes} participating votes · {decision.status === "MAJORITY" ? "Majority reached" : decision.status === "COLLECTING" ? "Needs at least 3 voters" : "No majority yet"}</small></div><Vote size={20} /></div>
        {decision.proposals.map((proposal) => <div className={`consensus-option ${decision.myVote === proposal.id ? "consensus-option--mine" : ""}`} key={proposal.id}>
          <div className="consensus-option-title"><b>{proposal.payload.kind === "LOCATION" ? proposal.payload.address : statusLabels[proposal.payload.status]}</b><strong>{proposal.share}% <small>({proposal.votes})</small></strong></div>
          {proposal.payload.kind === "LOCATION" ? <p>{proposal.payload.latitude.toFixed(4)}, {proposal.payload.longitude.toFixed(4)} · <a href={`https://www.openstreetmap.org/?mlat=${proposal.payload.latitude}&mlon=${proposal.payload.longitude}#map=17/${proposal.payload.latitude}/${proposal.payload.longitude}`} target="_blank" rel="noreferrer">View point <ExternalLink size={12} /></a></p>
            : <><p><b>Departments:</b> {proposal.payload.departments}</p><p>{proposal.payload.eligibility}</p><a href={proposal.payload.sourceUrl} target="_blank" rel="noreferrer">Review submitted source <ExternalLink size={12} /></a></>}
          <progress max={100} value={proposal.share} aria-label={`${proposal.votes} of ${decision.totalVotes} votes`} />
          <div className="consensus-option-actions"><span>{decision.winnerId === proposal.id ? <><Check size={13} /> Current majority</> : decision.acceptedProposalId === proposal.id ? "Last agreed result" : "Community proposal"}</span><button disabled={pending || (!joined && decision.myVote !== proposal.id)} onClick={() => vote(decision, decision.myVote === proposal.id ? null : proposal.id)}>{decision.myVote === proposal.id ? "Withdraw my vote" : "Support this"}</button></div>
        </div>)}
        {decision.kind === "PLACEMENT" && <p className="consensus-disclaimer">Student-reported information. Confirm eligibility, dates and company participation with your placement cell. Majority support is not a placement guarantee.</p>}
      </article>)}
      {!data.decisions.some((decision) => decision.kind === tab) && <div className="consensus-empty">{tab === "LOCATION" ? <MapPin size={28} /> : <BriefcaseBusiness size={28} />}<h3>{tab === "LOCATION" ? "Put your campus on the right spot." : "Know what’s coming to campus."}</h3><p>{tab === "LOCATION" ? "The current map is the listing’s starting point. Propose a correction for members to review." : "Share a company’s campus recruitment scope, eligible departments and a supporting notice. Let your campus review it together."}</p></div>}
    </div>
    {joined && <button className="consensus-compose" aria-expanded={formOpen} onClick={() => { setFormOpen((value) => !value); setError(""); setNotice(""); }}>{formOpen ? <X size={18} /> : <Plus size={18} />}{formOpen ? "Close proposal" : tab === "LOCATION" ? "Propose a location" : "Share a placement report"}</button>}
    {!joined && <p className="consensus-disclaimer">Join this campus to submit proposals or support one. Voter identities are not shown publicly. Votes remain on record until withdrawn; suspended accounts are excluded from tallies.</p>}
    {formOpen && joined && <form className="consensus-form" onSubmit={submit}>
      {tab === "LOCATION" ? <>
        <p>Only submit your device location if you are at the campus. This point will be public after submission.</p>
        <button type="button" className="small-action" disabled={pending} onClick={locate}><Navigation size={14} /> Use my location</button>
        <div className="form-two"><label>Latitude<input required type="number" step="any" min={-90} max={90} value={location.latitude} onChange={(event) => setLocation({ ...location, latitude: event.target.value })} /></label><label>Longitude<input required type="number" step="any" min={-180} max={180} value={location.longitude} onChange={(event) => setLocation({ ...location, longitude: event.target.value })} /></label></div>
        <label>Campus address / landmark<input required minLength={5} maxLength={300} value={location.address} onChange={(event) => setLocation({ ...location, address: event.target.value })} /></label>
      </> : <>
        <div className="form-two"><label>Company<input required minLength={2} maxLength={120} value={placement.company} onChange={(event) => setPlacement({ ...placement, company: event.target.value })} /></label><label>Academic year<input required pattern="20[0-9]{2}-[0-9]{2}" placeholder="2026-27" value={placement.academicYear} onChange={(event) => setPlacement({ ...placement, academicYear: event.target.value })} /></label></div>
        <label>Recruitment status<select value={placement.status} onChange={(event) => setPlacement({ ...placement, status: event.target.value as PlacementProposal["status"] })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Eligible departments<input required minLength={2} maxLength={300} placeholder="e.g. CSE, IT, ECE" value={placement.departments} onChange={(event) => setPlacement({ ...placement, departments: event.target.value })} /></label>
        <label>Eligibility and recruitment scope<textarea required minLength={10} maxLength={1500} placeholder="Describe the roles, graduating batch and criteria in the notice." value={placement.eligibility} onChange={(event) => setPlacement({ ...placement, eligibility: event.target.value })} /></label>
        <label>Supporting notice / company link<input required type="url" placeholder="https://" value={placement.sourceUrl} onChange={(event) => setPlacement({ ...placement, sourceUrl: event.target.value })} /></label>
      </>}
      <button className="button button--dark" disabled={pending}>{pending ? "Saving…" : "Submit proposal & my vote"}</button>
    </form>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <p className="inline-success" role="status">{notice}</p>
  </section>;
}
