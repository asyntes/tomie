const SCROLL_EDGE_EPSILON_PX = 1;

export function canElementScrollVerticallyInDirection(
    element: HTMLElement,
    deltaY: number,
): boolean {
    if (element.scrollHeight <= element.clientHeight) {
        return false;
    }

    const maxScrollTop = element.scrollHeight - element.clientHeight;

    if (deltaY > 0) {
        return element.scrollTop > SCROLL_EDGE_EPSILON_PX;
    }

    if (deltaY < 0) {
        return element.scrollTop < maxScrollTop - SCROLL_EDGE_EPSILON_PX;
    }

    return false;
}

export function resolveVerticalScrollLockTarget(
    eventTarget: EventTarget | null,
    scrollCandidates: Array<HTMLElement | null>,
): HTMLElement | null {
    if (!(eventTarget instanceof Node)) {
        return null;
    }

    for (const candidate of scrollCandidates) {
        if (!candidate) {
            continue;
        }
        if (candidate === eventTarget || candidate.contains(eventTarget)) {
            return candidate;
        }
    }

    return null;
}
