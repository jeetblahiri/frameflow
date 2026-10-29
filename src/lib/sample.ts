import { DEFAULT_CAMERA, layerFor } from '../model';
import type { Asset, Composition, Project } from '../model';
const svg = (body: string, w: number, h: number) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;
const globe = `<defs><radialGradient id="o" cx="30%" cy="25%"><stop stop-color="#6db0c0"/><stop offset=".55" stop-color="#307184"/><stop offset="1" stop-color="#0c344b"/></radialGradient><radialGradient id="a"><stop offset=".7" stop-color="#94c9cb" stop-opacity="0"/><stop offset="1" stop-color="#a9e1dc" stop-opacity=".6"/></radialGradient><clipPath id="c"><circle r="300"/></clipPath></defs><g transform="translate(540 1100)"><circle r="321" fill="#b6d2c9" opacity=".17"/><circle r="308" fill="#5e9ca7" opacity=".2"/><circle r="300" fill="url(#o)"/><g clip-path="url(#c)" fill="#b3bd83"><path d="M-220-230l90-15 20 40 65 0 37 42-25 46-54 11-25 52-49 15-28 42-56-7-30-60-44-32z"/><path d="M-105 5l88 24 36 66-29 38-14 76-54 63-24-79-40-48-15-71z"/><path d="M65-234l151 5 99 97-36 99-56-4-48 32-43-14-14-46-77-8-31-47 22-47z"/><path d="M59-48l67 27 40 60-9 78-58 57-39-35-17-70-25-57zM197 151l53-22 51 25-3 61-74 13-34-35z"/></g><g fill="none" stroke="#d8ecdf" stroke-width="2" opacity=".17"><ellipse rx="300" ry="115"/><ellipse rx="115" ry="300" transform="rotate(20)"/><ellipse rx="225" ry="300" transform="rotate(20)"/><path d="M-284-100q284-155 568 0M-284 100q284 155 568 0"/></g><circle r="300" fill="url(#a)"/><ellipse rx="430" ry="130" transform="rotate(-29)" fill="none" stroke="#a9baa2" stroke-width="2" stroke-dasharray="7 12"/><circle cx="376" cy="-202" r="13" fill="#c3dc8b"/><path d="M-350 280h175" stroke="#87947e" stroke-width="2"/><text x="-350" y="312" font-family="sans-serif" font-size="18" fill="#79806f" letter-spacing="3">OUR ONLY HOME.</text></g>`;
const cover = svg(
  `<rect width="1080" height="1920" fill="#e9e9dc"/><path d="M80 100h80" stroke="#35483b" stroke-width="5"/><text x="80" y="165" font-family="sans-serif" font-size="23" letter-spacing="7" fill="#65705e">A SHIFT IN PERSPECTIVE</text><text x="76" y="370" font-family="Georgia,serif" font-size="148" letter-spacing="-7" fill="#263e35">The overview</text><text x="76" y="527" font-family="Georgia,serif" font-size="148" letter-spacing="-7" fill="#263e35">effect.</text><text x="84" y="620" font-family="sans-serif" font-size="30" fill="#6c7465">Sometimes, the bigger picture changes everything.</text>${globe}<path d="M80 1710h920" stroke="#bdc5b4" stroke-width="2"/><text x="80" y="1770" font-family="sans-serif" font-size="22" letter-spacing="4" fill="#58634f">SMALL PLANET. BIG IDEAS.</text><text x="948" y="1770" font-family="sans-serif" font-size="22" fill="#58634f">01</text><text x="80" y="1840" font-family="sans-serif" font-size="20" fill="#8b9180">A visual story by you</text>`,
  1080,
  1920,
);
const earth = svg(
  `<rect width="1080" height="1320" fill="#152c31"/><g transform="translate(0 -420)">${globe}</g><text x="70" y="1160" font-family="Georgia,serif" font-size="64" fill="#e8ecdc">A world without borders.</text><text x="73" y="1220" font-family="sans-serif" font-size="23" letter-spacing="3" fill="#9aaa9d">THE VIEW THAT CHANGES YOU</text>`,
  1080,
  1320,
);
const orbit = svg(
  `<rect width="1100" height="760" fill="#d9e1d1"/><text x="65" y="95" font-family="sans-serif" font-size="22" letter-spacing="4" fill="#5d7059">ANATOMY OF A PERSPECTIVE SHIFT</text><g transform="translate(550 400)" fill="none" stroke="#82977a" stroke-width="2"><ellipse rx="400" ry="170" transform="rotate(-18)"/><ellipse rx="290" ry="220" transform="rotate(30)"/><circle r="110" fill="#344f40" stroke="none"/><circle cx="380" cy="-80" r="23" fill="#b1c77d"/><circle cx="-205" cy="-175" r="16" fill="#688b73"/></g><text x="550" y="408" text-anchor="middle" font-family="Georgia,serif" font-size="35" fill="#e2e9d8">you are here</text><text x="65" y="690" font-family="sans-serif" font-size="23" fill="#5d7059">Step back. See more. Feel differently.</text>`,
  1100,
  760,
);
const initialScript = `There’s a moment astronauts describe when they see Earth from space for the first time.\n\nThey call it the overview effect.\n\nSuddenly, borders disappear. The things that felt so big become small. And this little blue planet becomes everything.\n\nYou don’t have to go to space to find a new perspective. Sometimes, you just have to take a step back.\n\nWhat changes when you look at the bigger picture?`;
export function createSampleProject(): Project {
  const assets: Asset[] = [
    {
      id: 'cover',
      kind: 'image',
      name: 'The overview effect',
      src: cover,
      width: 1080,
      height: 1920,
      x: 80,
      y: 30,
      boardWidth: 215,
    },
    {
      id: 'earth',
      kind: 'image',
      name: 'Our little blue planet',
      src: earth,
      width: 1080,
      height: 1320,
      x: 870,
      y: 40,
      boardWidth: 265,
    },
    {
      id: 'orbit',
      kind: 'image',
      name: 'A shift in perspective',
      src: orbit,
      width: 1100,
      height: 760,
      x: 50,
      y: 570,
      boardWidth: 330,
    },
    {
      id: 'quote',
      kind: 'text',
      name: 'The bigger picture',
      text: 'Sometimes, all it takes is a little distance to see what has been there all along.\n\nA SHIFT IN PERSPECTIVE',
      background: '#e4dccd',
      color: '#484a3e',
      fontSize: 61,
      width: 1080,
      height: 1500,
      x: 890,
      y: 570,
      boardWidth: 245,
    },
    {
      id: 'note',
      kind: 'article',
      name: 'A note on perspective',
      text: 'THE OVERVIEW EFFECT\n\nA different point of view.\n\nThe overview effect describes the cognitive shift some astronauts experience when they see Earth from space.\n\nFrom above, national boundaries are invisible. Our atmosphere is a thin, fragile layer. The whole planet feels interconnected.\n\nTry it here on Earth: step back, change your surroundings, and look at something familiar with fresh eyes.',
      background: '#e8e9dc',
      color: '#35483b',
      fontSize: 48,
      width: 1080,
      height: 1920,
      x: 60,
      y: 990,
      boardWidth: 240,
    },
  ];
  const composition = (asset: Asset): Composition => ({
    layers: [layerFor(asset)],
    background: '#e9e9dc',
    camera: { ...DEFAULT_CAMERA },
    annotations: [],
    branding: false,
  });
  const scenes = [
    {
      id: 'scene-1',
      name: 'The hook',
      composition: composition(assets[0]),
      script: initialScript,
      transition: 'cut' as const,
    },
    {
      id: 'scene-2',
      name: 'A new perspective',
      composition: composition(assets[1]),
      script:
        'Imagine looking down at Earth. No borders. No noise. Just our little blue planet, suspended in the dark.',
      transition: 'fade' as const,
    },
    {
      id: 'scene-3',
      name: 'The bigger picture',
      composition: composition(assets[3]),
      script:
        'The astronauts who experienced it came back with a different understanding of home. What if we could see the world that way?',
      transition: 'fade' as const,
    },
    {
      id: 'scene-4',
      name: 'Take a step back',
      composition: composition(assets[2]),
      script:
        'Change your surroundings. Get curious. Take a step back. A small shift in perspective can make a big difference.',
      transition: 'fade' as const,
    },
  ];
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: 'A little perspective',
    assets,
    scenes,
    activeSceneId: 'scene-1',
    canvas: { x: 0, y: 0, zoom: 0.72 },
    updatedAt: Date.now(),
  };
}
