export { cn } from "cn"

/** "1 session", "2 sessions". */
export const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`
