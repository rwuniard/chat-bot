export function getShellLayoutClass(isDesktopViewport: boolean, isDesktopPanelVisible: boolean): string {
  if (!isDesktopViewport) {
    return "block";
  }

  if (isDesktopPanelVisible) {
    return "lg:grid lg:grid-cols-[320px_minmax(0,1fr)]";
  }

  return "lg:block";
}

export function getChatPaneVisibilityClass(isDesktopViewport: boolean, mobilePane: "chat" | "panel"): string {
  if (isDesktopViewport || mobilePane === "chat") {
    return "flex";
  }

  return "hidden";
}

export function getSidebarVisible(isDesktopViewport: boolean, isDesktopPanelVisible: boolean, mobilePane: "chat" | "panel"): boolean {
  if (isDesktopViewport) {
    return isDesktopPanelVisible;
  }

  return mobilePane === "panel";
}
