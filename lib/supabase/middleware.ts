import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROSEPULSE_PROPERTY_ID, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

const APP_ROUTE_PATTERN = /^\/(?:today|arriving|guests|guest-pulse|tickets|radio|voice-notes)(?:\/|$)/;

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return response;
  }

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAppRoute = APP_ROUTE_PATTERN.test(pathname);
  const isLoginRoute = pathname === "/login";

  if (!isAppRoute && !isLoginRoute) {
    return response;
  }

  let hasMembership = false;
  if (user) {
    const { data } = await supabase
      .from("staff_property_memberships")
      .select("id")
      .eq("property_id", ROSEPULSE_PROPERTY_ID)
      .eq("auth_user_id", user.id)
      .eq("active", true)
      .maybeSingle();
    hasMembership = Boolean(data);
  }

  if (isLoginRoute && user && hasMembership) {
    return NextResponse.redirect(new URL("/today", request.url));
  }

  if (isAppRoute && (!user || !hasMembership)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    if (user && !hasMembership) loginUrl.searchParams.set("error", "membership");
    return NextResponse.redirect(loginUrl);
  }

  return response;
}
