const revealTargets = Array.from(document.querySelectorAll("[data-reveal]"))

document.documentElement.classList.add("motion-ready")

function revealAll() {
  for (const target of revealTargets) {
    target.classList.add("is-visible")
  }
}

if (!("IntersectionObserver" in window)) {
  revealAll()
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) {
          continue
        }

        entry.target.classList.add("is-visible")
        observer.unobserve(entry.target)
      }
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -48px 0px"
    }
  )

  for (const target of revealTargets) {
    observer.observe(target)
  }

  document.addEventListener("ui:refresh-reveal", () => {
    const pending = document.querySelectorAll("[data-reveal]:not(.is-visible)")
    for (const target of pending) {
      observer.observe(target)
    }
  })
}
