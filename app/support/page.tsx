"use client";

import Link from "next/link";
import { useEffect,useState,type FormEvent } from "react";
import LnkditHeader from "@/app/components/lnkdit-header";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

type Ticket = {id:string;title:string;message:string;status:string;reply:string|null;created_at:string};
export default function SupportPage() {
  const [signedIn,setSignedIn]=useState(false);
  const [loading,setLoading]=useState(true);
  const [tickets,setTickets]=useState<Ticket[]>([]);
  const [title,setTitle]=useState("");
  const [message,setMessage]=useState("");
  const [feedback,setFeedback]=useState("");
  const [busy,setBusy]=useState(false);
  const [failed,setFailed]=useState(false);
  const refresh=async()=>{
    const client=getSupabaseBrowserClient();
    const session=client?(await client.auth.getSession()).data.session:null;
    setSignedIn(Boolean(session));
    if(session){
      const response=await fetch("/api/support",{headers:{Authorization:`Bearer ${session.access_token}`},cache:"no-store"});
      if(!response.ok) throw new Error("Support requests could not be loaded. Please refresh to try again.");
      const body=await response.json();setTickets(body.requests??[]);
    }else setTickets([]);
    setLoading(false);
  };
  useEffect(()=>{let active=true;const client=getSupabaseBrowserClient();const load=()=>{if(active) void refresh().catch(error=>{if(active){setFeedback(error.message);setFailed(true);setLoading(false);}});};load();const listener=client?.auth.onAuthStateChange(()=>{queueMicrotask(load);});return()=>{active=false;listener?.data.subscription.unsubscribe();};},[]);
  const submit=async(event:FormEvent)=>{
    event.preventDefault();if(busy)return;setBusy(true);setFeedback("");setFailed(false);
    try{
      const session=(await getSupabaseBrowserClient()?.auth.getSession())?.data.session;
      if(!session)throw new Error("Please sign in before sending a support request.");
      const response=await fetch("/api/support",{method:"POST",headers:{Authorization:`Bearer ${session.access_token}`,"Content-Type":"application/json"},body:JSON.stringify({title,message})});
      if(!response.ok)throw new Error(response.status===429?"You have reached today’s support request limit. Please try again tomorrow.":"Your request could not be sent. Please try again.");
      setTitle("");setMessage("");await refresh();setFeedback("Your request has been sent. Check this page for our reply.");
    }catch(error){setFailed(true);setFeedback(error instanceof Error?error.message:"Please try again.");}finally{setBusy(false);}
  };
  return <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-950"><div className="mx-auto max-w-3xl"><LnkditHeader><Link href="/workspace" className="text-sm underline">Workspace</Link></LnkditHeader><h1 className="text-4xl font-bold">Support</h1><p className="mt-4 text-slate-600">Tell us what happened, when it happened, and any error reference shown. Keep passwords, payment details, and confidential company information out of your message.</p>{loading?<p className="mt-8">Loading…</p>:signedIn?<><form onSubmit={submit} className="mt-8 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6"><label className="grid gap-2 text-sm font-semibold">Subject<input className="auth-input rounded-lg border border-slate-300 p-3 text-base" required maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="grid gap-2 text-sm font-semibold">What happened?<textarea className="auth-input min-h-36 rounded-lg border border-slate-300 p-3 text-base" required maxLength={4000} value={message} onChange={e=>setMessage(e.target.value)}/></label><button disabled={busy} className="rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy?"Sending…":"Send request"}</button><p className="text-sm text-slate-500">Your requests and replies are private to your account. We’ll reply here.</p></form><h2 className="mt-10 text-2xl font-semibold">Your requests</h2>{tickets.length===0?<p className="mt-4 text-slate-600">No support requests yet.</p>:<div className="mt-4 grid gap-4">{tickets.map(ticket=><article key={ticket.id} className="rounded-xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><h3 className="font-semibold">{ticket.title}</h3><span className="text-sm capitalize text-slate-600">{ticket.status}</span></div><p className="mt-2 text-xs text-slate-500">Reference {ticket.id.slice(0,8)} · {new Date(ticket.created_at).toLocaleDateString()}</p><p className="mt-4 whitespace-pre-wrap break-words text-sm text-slate-700">{ticket.message}</p>{ticket.reply&&<div className="mt-4 rounded-lg bg-cyan-50 p-4"><p className="text-sm font-semibold">LNKDIT reply</p><p className="mt-2 whitespace-pre-wrap break-words text-sm">{ticket.reply}</p></div>}</article>)}</div>}</>:<Link href="/auth?next=%2Fsupport" className="mt-8 inline-block rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">Sign in to contact support</Link>}{feedback&&<p role={failed?"alert":"status"} className={`mt-5 rounded-lg p-4 text-sm ${failed?"bg-red-50 text-red-800":"bg-green-50 text-green-800"}`}>{feedback}</p>}</div></main>;
}
