import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Security hardening: do not trust a client-writable cookie
  // for authentication decisions in middleware.
  void request;
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo\\.png|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)",
  ],
};
