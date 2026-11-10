"use client";
import Link from "next/link";
import { useState, type ComponentProps } from "react";

// Storefront data is dynamic. Avoid speculative server/DB requests for every
// visible menu/card; ordinary client navigation still loads fresh data on click.
export function StoreLink({ onMouseEnter, onFocus, ...props }: ComponentProps<typeof Link>) {
  const [intent, setIntent] = useState(false);
  return <Link {...props} prefetch={intent ? null : false}
    onMouseEnter={event => { setIntent(true); onMouseEnter?.(event); }}
    onFocus={event => { setIntent(true); onFocus?.(event); }} />;
}
