import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// The router restores scroll on navigation; jsdom does not implement it.
window.scrollTo = () => {}
// Picking a session up by keyboard scrolls it into view; jsdom has no layout.
Element.prototype.scrollIntoView = () => {}

afterEach(() => {
  cleanup()
})
