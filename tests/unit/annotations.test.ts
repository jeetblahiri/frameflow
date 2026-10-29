import { describe, expect, it } from 'vitest';
import { hitsAnnotation } from '../../src/engine/annotations';
import type { Annotation, Tool } from '../../src/model';
const mark = (tool: Tool): Annotation => ({
  id: 'test',
  tool,
  color: '#ffffff',
  width: 0.005,
  points: [
    { x: 0.2, y: 0.2 },
    { x: 0.8, y: 0.8 },
  ],
  createdAt: 0,
});
describe('annotation erasing', () => {
  it('hits rectangle edges away from the diagonal', () => {
    expect(hitsAnnotation(mark('rectangle'), { x: 0.5, y: 0.2 })).toBe(true);
  });
  it('preserves the empty interior of an outlined shape', () => {
    expect(hitsAnnotation(mark('rectangle'), { x: 0.5, y: 0.5 })).toBe(false);
    expect(hitsAnnotation(mark('circle'), { x: 0.5, y: 0.5 })).toBe(false);
  });
  it('hits an ellipse boundary in output coordinates', () => {
    expect(hitsAnnotation(mark('circle'), { x: 0.8, y: 0.5 })).toBe(true);
  });
  it('erases a stroke between sampled pointer points', () => {
    expect(hitsAnnotation(mark('pen'), { x: 0.5, y: 0.5 })).toBe(true);
    expect(hitsAnnotation(mark('pen'), { x: 0.1, y: 0.8 })).toBe(false);
  });
});
