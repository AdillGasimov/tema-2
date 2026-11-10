"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PublicProduct } from "@/lib/catalog";
import { publicImageSrc } from "@/lib/public-image";
import { StoreLink } from "./store-link";

type Photo = Pick<PublicProduct["images"][number], "id" | "key" | "alt">;
type Props = { images: Photo[]; name: string; href?: string; mode: "card" | "detail"; discounted?: boolean };
const subscribeToReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

export function ProductPhotos({ images, name, href, mode, discounted = false }: Props) {
  const ready = useSyncExternalStore(subscribeToReady, clientReady, serverReady);
  const track = useRef<HTMLDivElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);
  const selected = useRef(0);
  const [index, setIndex] = useState(0);
  // Do not request every full-size gallery photo just because a card is visible.
  const [loaded, setLoaded] = useState(() => new Set([0]));
  const multiple = images.length > 1;

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return;
      width = element.clientWidth;
      element.scrollTo({ left: selected.current * width, behavior: "instant" });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [images.length]);

  function load(...positions: number[]) {
    const valid = positions.filter(n => n >= 0 && n < images.length);
    setLoaded(previous => valid.every(n => previous.has(n)) ? previous : new Set([...previous, ...valid]));
  }
  function scrolled() {
    const element = track.current;
    if (!element?.clientWidth) return;
    const position = element.scrollLeft / element.clientWidth;
    const next = Math.max(0, Math.min(images.length - 1, Math.round(position)));
    selected.current = next;
    setIndex(next);
    load(Math.floor(position), Math.ceil(position));
  }
  function select(next: number) {
    const element = track.current;
    if (!element || next < 0 || next >= images.length) return;
    load(next);
    selected.current = next;
    const instant = Math.abs(next - index) > 1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    element.scrollTo({ left: next * element.clientWidth, behavior: instant ? "instant" : "smooth" });
  }
  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    dragged.current = false;
    if (event.altKey || event.ctrlKey || event.metaKey || !multiple) return;
    const next = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: images.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    select(next);
  }

  const dotStart = Math.max(0, Math.min(index - 2, images.length - 5));
  return <div className={`product-gallery product-gallery-${mode}`} role="group" aria-label={`${name} — məhsul şəkilləri`} aria-roledescription={multiple ? "karusel" : undefined} aria-busy={!ready}>
    <div className={`${mode === "card" ? "product-visual" : "detail-image"} product-photos`}>
      {images.length ? <div className="product-photo-track" ref={track} data-ready={ready} onScroll={scrolled} onKeyDown={keyDown} tabIndex={multiple && ready ? 0 : undefined} role="group" aria-label={multiple ? "Şəkilləri ox düymələri ilə dəyişin" : "Məhsul şəkli"}
        onPointerDown={event => { pointer.current = { x: event.clientX, y: event.clientY }; dragged.current = false; }}
        onPointerMove={event => { if (pointer.current && (Math.abs(event.clientX - pointer.current.x) > 8 || Math.abs(event.clientY - pointer.current.y) > 8)) dragged.current = true; }}
        onPointerCancel={() => { if (pointer.current) dragged.current = true; pointer.current = null; }}
        onClickCapture={event => { if (dragged.current) { event.preventDefault(); event.stopPropagation(); dragged.current = false; } }}>
        {images.map((photo, n) => {
          const content = <span className={mode === "card" ? "product-image-frame" : "product-photo-frame"}>
            {loaded.has(n) && <Image src={publicImageSrc(photo.key)} alt={photo.alt || name} fill sizes={mode === "card" ? "(max-width: 600px) 45vw, (max-width: 1000px) 30vw, 24vw" : "(max-width: 768px) 100vw, 50vw"} priority={mode === "detail" && n === 0} draggable={false} />}
          </span>;
          return href ? <StoreLink key={photo.id} href={href} className="product-photo-slide" aria-label={name} aria-hidden={n !== index} tabIndex={n === index ? undefined : -1} draggable={false}>{content}</StoreLink>
            : <div key={photo.id} className="product-photo-slide" role="group" aria-label={`Şəkil ${n + 1} / ${images.length}`} aria-hidden={n !== index}>{content}</div>;
        })}
      </div> : <span>Şəkil əlavə ediləcək</span>}
      {mode === "card" && discounted && <span className="product-tag">Endirim</span>}
      {multiple && <>
        <button type="button" className="photo-arrow photo-previous" onClick={() => select(index - 1)} disabled={!ready || index === 0} aria-label="Əvvəlki şəkil"><ChevronLeft size={20} /></button>
        <button type="button" className="photo-arrow photo-next" onClick={() => select(index + 1)} disabled={!ready || index === images.length - 1} aria-label="Növbəti şəkil"><ChevronRight size={20} /></button>
        <span className="photo-count" role="status" aria-live="polite" aria-atomic="true"><span className="sr-only">Şəkil </span>{index + 1} / {images.length}</span>
        {mode === "card" && <div className="photo-dots" aria-label="Şəkil seçin">{Array.from({ length: Math.min(5, images.length) }, (_, offset) => {
          const n = dotStart + offset;
          return <button type="button" key={n} disabled={!ready} onClick={() => select(n)} aria-label={`Şəkil ${n + 1}`} aria-current={n === index ? "true" : undefined}><span /></button>;
        })}</div>}
      </>}
    </div>
    {mode === "detail" && multiple && <div className="thumbnails">{images.map((photo, n) => <button type="button" key={photo.id} disabled={!ready} className={n === index ? "selected" : ""} aria-label={`${name} şəkil ${n + 1}`} aria-current={n === index ? "true" : undefined} onClick={() => select(n)}><Image src={publicImageSrc(photo.key)} width={72} height={72} alt={photo.alt || name} draggable={false} /></button>)}</div>}
  </div>;
}
