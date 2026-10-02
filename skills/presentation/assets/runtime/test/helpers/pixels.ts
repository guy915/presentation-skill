// The browser is the image library: PNGs are decoded in a page via canvas.
import type { Page } from "@playwright/test";

type Png = Buffer | string; // a PNG buffer or a data URL

/** Share of pixels that may differ beyond `threshold` between two renders of
 *  one state: antialiased edges, video frames and the ends of dashes land a
 *  few pixels differently played and seeked. Screenshots and canvases alike. */
export const MAX_DIFF = 0.002;

const url = (x: Png) => (typeof x === "string" ? x : `data:image/png;base64,${x.toString("base64")}`);

/** Decodes each image in the page and runs `fn` on their RGBA pixels there. */
function decoded<A, R>(page: Page, images: Png[], arg: A, fn: (imgs: ImageData[], arg: A) => R): Promise<R> {
  return page.evaluate(
    async ([srcs, arg, fn]) => {
      const imgs = await Promise.all(
        srcs.map(async (src) => {
          const bmp = await createImageBitmap(await (await fetch(src)).blob());
          const g = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d")!;
          g.drawImage(bmp, 0, 0);
          return g.getImageData(0, 0, bmp.width, bmp.height);
        }),
      );
      return new Function(`return (${fn})`)()(imgs, arg);
    },
    [images.map(url), arg, fn.toString()] as const,
  ) as Promise<R>;
}

/** Pixels whose largest channel difference exceeds `threshold`, of `total`.
 *  Two images of different sizes differ everywhere. */
export const diffPixels = (page: Page, a: Png, b: Png, threshold = 24) =>
  decoded(page, [a, b], threshold, ([x, y], threshold) => {
    const total = Math.max(x.data.length, y.data.length) / 4;
    if (x.data.length !== y.data.length) return { differ: total, total };
    let differ = 0;
    for (let i = 0; i < x.data.length; i += 4) {
      let d = 0;
      for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(x.data[i + c] - y.data[i + c]));
      if (d > threshold) differ++;
    }
    return { differ, total };
  });

/** The RGBA of an image at each [x, y] point. */
export const pixelsAt = (page: Page, png: Png, points: number[][]) =>
  decoded(page, [png], points, ([img], points) =>
    points.map(([x, y]) => {
      const i = (Math.round(y) * img.width + Math.round(x)) * 4;
      return [...img.data.slice(i, i + 4)];
    }),
  );
