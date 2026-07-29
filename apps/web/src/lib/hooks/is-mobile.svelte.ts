let isMobile = $state(false);

export class IsMobile {
  #current = $state(false);

  constructor() {
    this.#current = typeof window !== "undefined" && window.innerWidth < 768;
    const mql =
      typeof window !== "undefined"
        ? window.matchMedia("(max-width: 767px)")
        : null;

    const handler = (e: MediaQueryListEvent) => {
      this.#current = e.matches;
      isMobile = e.matches;
    };

    if (mql) {
      mql.addEventListener("change", handler);
    }
  }

  get current() {
    return this.#current;
  }

  get isMobile() {
    return isMobile;
  }
}
