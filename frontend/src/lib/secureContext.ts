/**
 * Why a feature is unavailable, so the citizen is told the truth.
 *
 * Browsers gate geolocation, speech recognition and the camera behind a
 * *secure context*: HTTPS, or `localhost`. A phone opening this app over the
 * LAN — `http://192.168.x.x:3000` — is not a secure context, so those APIs are
 * refused before any permission prompt appears. The page looks broken: the
 * button does nothing, or reports a denial the citizen never made.
 *
 * That distinction matters here. "You denied location" is wrong and
 * unactionable when the browser never asked. "This page is not on HTTPS" is
 * true and tells whoever is running the demo what to change.
 *
 * `localhost` is exempt from the rule, which is exactly why a laptop shows no
 * symptom and a phone on the same Wi-Fi fails at every one of these features.
 */

/** Is this page allowed to use geolocation, speech and camera at all? */
export function isSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  // `isSecureContext` is the browser's own verdict and already treats
  // localhost and 127.0.0.1 as secure. Older engines that lack it get the
  // benefit of the doubt on https.
  if (typeof window.isSecureContext === "boolean") return window.isSecureContext;
  return window.location.protocol === "https:";
}

/**
 * True when the page is served over plain HTTP from somewhere other than this
 * device — the case that breaks a phone on the LAN and nothing else.
 */
export function isInsecureRemoteOrigin(): boolean {
  if (typeof window === "undefined") return false;
  return !isSecureContext();
}
