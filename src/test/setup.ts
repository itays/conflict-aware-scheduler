import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

// The router restores scroll on navigation; jsdom does not implement it.
window.scrollTo = () => {}

afterEach(() => {
  cleanup()
})
