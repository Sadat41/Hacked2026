declare module "dom-to-image-more" {
  export function toBlob(node: HTMLElement, options?: Record<string, unknown>): Promise<Blob>;
  export function toPng(node: HTMLElement, options?: Record<string, unknown>): Promise<string>;
  export function toJpeg(node: HTMLElement, options?: Record<string, unknown>): Promise<string>;
  export function toSvg(node: HTMLElement, options?: Record<string, unknown>): Promise<string>;
}
