/**
 * Pauses execution for the given number of milliseconds.
 * @example await sleep(1000); // waits 1 second
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
