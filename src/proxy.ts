import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export function proxy(request: NextRequest) {
  return updateSession(request);
}

// "/" runs this too so the session token stays refreshed on the (now public)
// homepage. Other public routes should never depend on Supabase being
// configured.
export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/games/:path*",
    "/users/:path*",
    "/auth/:path*",
  ],
};
