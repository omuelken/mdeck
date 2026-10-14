// Full screen, with Safari's prefixed names (iPad); unavailable on an iPhone.
export function fullscreenAvailable() {
  return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
}
// Older Safari (iPad) names the element and the exit differently; a miss
// here made the button enter full screen again instead of leaving it, and
// an iPad has no Escape key to get out.
export function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.webkitCurrentFullScreenElement || null;
}
export function toggleFullscreen(element = document.documentElement) {
  if (fullscreenElement()) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.webkitCancelFullScreen;
    return exit?.call(document);
  }
  const request = element.requestFullscreen || element.webkitRequestFullscreen;
  return request?.call(element);
}
/** Calls back with true or false whenever the page enters or leaves full screen; returns a function that stops it. */
export function onFullscreenChange(listener) {
  const handler = () => listener(!!fullscreenElement());
  for (const name of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(name, handler);
  return () => { for (const name of ['fullscreenchange', 'webkitfullscreenchange']) document.removeEventListener(name, handler); };
}
