export function nowIso(): string {
  return new Date().toISOString();
}

export function addMs(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

export function maxIso(left: string | null | undefined, right: string): string {
  if (!left) {
    return right;
  }
  return new Date(left).getTime() >= new Date(right).getTime() ? left : right;
}

export function isAfter(left: string, right: string): boolean {
  return new Date(left).getTime() > new Date(right).getTime();
}
