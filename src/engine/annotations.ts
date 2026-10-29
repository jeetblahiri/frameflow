import type { Annotation, Point } from '../model';
import { clamp } from '../model';
const outputPoint = (p: Point) => ({ x: p.x, y: (p.y * 16) / 9 });
function segmentDistance(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
/** Hit the drawn outline, rather than a shape's diagonal or its empty interior. */
export function hitsAnnotation(annotation: Annotation, point: Point, radius = 0.04): boolean {
  const points = annotation.points.map(outputPoint);
  if (!points.length) return false;
  const p = outputPoint(point),
    a = points[0],
    b = points.at(-1)!;
  const tolerance = radius + (annotation.width * (annotation.tool === 'highlighter' ? 4 : 1)) / 2;
  if (annotation.tool === 'rectangle')
    return [
      [a, { x: b.x, y: a.y }],
      [{ x: b.x, y: a.y }, b],
      [b, { x: a.x, y: b.y }],
      [{ x: a.x, y: b.y }, a],
    ].some(([from, to]) => segmentDistance(p, from, to) <= tolerance);
  if (annotation.tool === 'circle') {
    const cx = (a.x + b.x) / 2,
      cy = (a.y + b.y) / 2,
      rx = Math.abs(a.x - b.x) / 2,
      ry = Math.abs(a.y - b.y) / 2;
    if (rx < 0.001 || ry < 0.001) return segmentDistance(p, a, b) <= tolerance;
    const angle = Math.atan2((p.y - cy) / ry, (p.x - cx) / rx);
    return (
      Math.hypot(p.x - cx - rx * Math.cos(angle), p.y - cy - ry * Math.sin(angle)) <= tolerance
    );
  }
  return points.some((v, i) => segmentDistance(p, v, points[i + 1] || v) <= tolerance);
}
