import { config } from "./config"

export type Locatable = URL | string

export function expandURL(locatable: Locatable) {
  return new URL(locatable.toString(), document.baseURI)
}

export function getAnchor(url: URL) {
  let anchorMatch
  if (url.hash) {
    return url.hash.slice(1)
    // eslint-disable-next-line no-cond-assign
  } else if ((anchorMatch = url.href.match(/#(.*)$/))) {
    return anchorMatch[1]
  }
}

export function getAction(form: HTMLFormElement, submitter?: HTMLElement) {
  const action = submitter?.getAttribute("formaction") || form.getAttribute("action") || form.action

  return expandURL(action)
}

export function getExtension(url: URL) {
  return ((getLastPathComponent(url) ?? "").match(/\.[^.]*$/) || [])[0] || ""
}

export function isPrefixedBy(baseURL: URL, url: URL) {
  const prefix = addTrailingSlash(url.origin + url.pathname)
  return addTrailingSlash(baseURL.href) === prefix || baseURL.href.startsWith(prefix)
}

export function locationIsVisitable(location: URL, rootLocation: URL) {
  return isPrefixedBy(location, rootLocation) && !config.drive.unvisitableExtensions.has(getExtension(location))
}

export function getLocationForLink(link: Element) {
  return expandURL(link.getAttribute("href") || "")
}

export function getRequestURL(url: URL) {
  const anchor = getAnchor(url)
  return anchor != null ? url.href.slice(0, -(anchor.length + 1)) : url.href
}

export function toCacheKey(url: URL) {
  return getRequestURL(url)
}

export function urlsAreEqual(left: Locatable, right: Locatable) {
  return expandURL(left).href == expandURL(right).href
}

function getPathComponents(url: URL) {
  return url.pathname.split("/").slice(1)
}

function getLastPathComponent(url: URL) {
  return getPathComponents(url).slice(-1)[0]
}

function addTrailingSlash(value: string) {
  return value.endsWith("/") ? value : value + "/"
}
