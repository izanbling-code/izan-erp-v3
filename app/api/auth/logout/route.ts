import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Redirect the user back to the login page
  const response = NextResponse.redirect(new URL("/login", request.url));
  
  // Nuke both the new V3 cookie and the old V2 cookie just in case
  response.cookies.delete("ib_session");
  response.cookies.delete("izan_session");
  
  return response;
}