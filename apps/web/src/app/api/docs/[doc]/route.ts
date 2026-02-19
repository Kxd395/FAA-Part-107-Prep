import { NextRequest, NextResponse } from "next/server";

const DOC_UPSTREAM: Record<string, string> = {
  "uas-acs": "https://www.faa.gov/sites/faa.gov/files/training_testing/testing/acs/uas_acs.pdf",
  "remote-pilot-study-guide":
    "https://www.faa.gov/sites/faa.gov/files/regulations_policies/handbooks_manuals/aviation/remote_pilot_study_guide.pdf",
};

const PASSTHROUGH_HEADERS = [
  "accept-ranges",
  "content-length",
  "content-range",
  "etag",
  "last-modified",
] as const;

export const revalidate = 86400;

export async function GET(
  request: NextRequest,
  { params }: { params: { doc: string } }
) {
  const upstreamUrl = DOC_UPSTREAM[params.doc];
  if (!upstreamUrl) {
    return NextResponse.json({ error: "Unknown document" }, { status: 404 });
  }

  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) {
    headers.set("Range", range);
  }

  const upstream = await fetch(upstreamUrl, {
    headers,
    next: { revalidate: 86400 },
  });

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json(
      { error: `Failed to fetch document (${upstream.status})` },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers();
  for (const headerName of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(headerName);
    if (value) responseHeaders.set(headerName, value);
  }

  responseHeaders.set("Content-Type", "application/pdf");
  responseHeaders.set(
    "Content-Disposition",
    `inline; filename="${params.doc}.pdf"`
  );
  responseHeaders.set(
    "Cache-Control",
    "public, max-age=0, s-maxage=86400, stale-while-revalidate=604800"
  );

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
