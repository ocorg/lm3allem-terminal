import { after } from "next/server"

/**
 * Runs a side effect (activity log, notification, Telegram) AFTER the response has been sent,
 * so the person at the counter never waits for it. Outside a request (CLI scripts) it simply
 * runs right away. The task must handle its own errors.
 */
export async function defer(task: () => Promise<void>): Promise<void> {
  try {
    after(task)
  } catch {
    await task()
  }
}
