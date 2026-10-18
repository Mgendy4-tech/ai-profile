import { NextResponse } from "next/server";
import { authenticatedSupabase } from "@/lib/supabase-server";
import { readCloudWorkspaceJson } from "@/lib/cloud-workspace-request";

export async function GET(request: Request) {
  const auth = await authenticatedSupabase(request);
  if ("error" in auth) return NextResponse.json({ok:false},{status:auth.error==="unauthorized"?401:503});
  const result = await auth.client.from("support_requests").select("id,title,message,status,reply,created_at").eq("user_id",auth.userId).order("created_at",{ascending:false}).limit(25);
  if (result.error) return NextResponse.json({ok:false},{status:503});
  return NextResponse.json({ok:true,requests:result.data},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(request: Request) {
  const auth = await authenticatedSupabase(request);
  if ("error" in auth) return NextResponse.json({ok:false},{status:auth.error==="unauthorized"?401:503});
  const parsed = await readCloudWorkspaceJson(request);
  if (!parsed.ok) return NextResponse.json({ok:false},{status:parsed.code==="payload_too_large"?413:400});
  const value = parsed.value as Record<string,unknown> | null;
  const title = typeof value?.title==="string"?value.title.trim():"";
  const message = typeof value?.message==="string"?value.message.trim():"";
  if (!title || title.length>120 || !message || message.length>4000) return NextResponse.json({ok:false,code:"invalid_message"},{status:400});
  const result = await auth.client.from("support_requests").insert({user_id:auth.userId,title,message}).select("id").single();
  if (result.error) return NextResponse.json({ok:false,code:result.error.code==="P0001"?"daily_limit":"unavailable"},{status:result.error.code==="P0001"?429:503});
  return NextResponse.json({ok:true,id:result.data.id},{status:201});
}
