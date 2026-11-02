/** Run asynchronous work with a bounded number of in-flight tasks. */
export async function forEachConcurrent<T>(
  items: readonly T[],
  concurrency: number,
  work: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;

  let nextIndex = 0;
  const workerCount = Math.min(
    items.length,
    Math.max(1, Math.trunc(concurrency)),
  );

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        await work(items[index]);
      }
    }),
  );
}
