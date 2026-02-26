import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { REQUEST_ID_HEADER, getOrCreateRequestId } from "./requestId";
import { recordRouteMetric } from "./routeMetrics";

export interface ApiRequestTracker {
  requestId: string;
  route: string;
  method: string;
  respond(response: NextResponse): NextResponse;
  json(body: unknown, init?: ResponseInit): NextResponse;
}

export function startApiRequest(request: NextRequest, route: string): ApiRequestTracker {
  const requestId = getOrCreateRequestId(request.headers);
  const method = request.method.toUpperCase();
  const startedAt = Date.now();

  function respond(response: NextResponse): NextResponse {
    response.headers.set(REQUEST_ID_HEADER, requestId);
    recordRouteMetric({
      route,
      method,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    return response;
  }

  return {
    requestId,
    route,
    method,
    respond,
    json: (body, init) => respond(NextResponse.json(body, init)),
  };
}
