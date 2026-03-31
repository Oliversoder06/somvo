import { useMemo } from "react";

const THUMB_TILE_W = 96;

export { THUMB_TILE_W };

export function useVisibleTiles(
  pool: { time: number; url: string }[],
  duration: number,
  zoom: number,
  scrollLeft: number,
  viewportWidth: number,
) {
  return useMemo(() => {
    if (pool.length === 0 || duration <= 0 || viewportWidth <= 0) return [];

    const totalWidth = viewportWidth * zoom;
    const totalTiles = Math.ceil(totalWidth / THUMB_TILE_W);
    const secPerTile = duration / totalTiles;

    const firstVisible = Math.max(0, Math.floor(scrollLeft / THUMB_TILE_W) - 1);
    const lastVisible = Math.min(
      totalTiles - 1,
      Math.ceil((scrollLeft + viewportWidth) / THUMB_TILE_W) + 1,
    );

    const tiles: { index: number; left: number; url: string }[] = [];
    for (let i = firstVisible; i <= lastVisible; i++) {
      const tileTime = (i + 0.5) * secPerTile;
      let best = pool[0];
      let bestDist = Math.abs(pool[0].time - tileTime);
      for (let j = 1; j < pool.length; j++) {
        const d = Math.abs(pool[j].time - tileTime);
        if (d < bestDist) {
          best = pool[j];
          bestDist = d;
        }
      }
      tiles.push({ index: i, left: i * THUMB_TILE_W, url: best.url });
    }
    return tiles;
  }, [pool, duration, zoom, scrollLeft, viewportWidth]);
}
