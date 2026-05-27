import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuth = request.cookies.get("minierp_auth")?.value === "1";
  const isLogin = pathname.startsWith("/login");

  if (!isAuth && !isLogin && pathname !== "/") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuth && isLogin) {
    return NextResponse.redirect(new URL("/projects", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
