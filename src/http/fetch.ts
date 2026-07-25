import { uuid } from "../util"
import { LimitedSet } from "../core/drive/limited_set"

export const recentRequests = new LimitedSet<string>(20)

function fetchWithBoostHeaders(url: RequestInfo | URL, options: RequestInit = {}) {
  const modifiedHeaders = new Headers(options.headers || {})
  const requestUID = uuid()
  recentRequests.add(requestUID)
  modifiedHeaders.append("X-Boost-Request-Id", requestUID)

  return window.fetch(url, {
    ...options,
    headers: modifiedHeaders
  })
}

export { fetchWithBoostHeaders as fetch }
