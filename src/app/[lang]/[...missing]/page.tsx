import { notFound } from 'next/navigation';

// any other path under a language gets the site's own 404 (with its header), not the bare default
export default function Missing() {
  notFound();
}
