// Growth curve shared by the dinosaur and the HUD: one "evolution" value 0..5 drives size.
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));

export function stageValues(e) {
  return { size: 1 + 2 * clamp(e) + 6 * clamp(e - 1) + 5 * clamp(e - 2) + 6 * clamp(e - 3) + 20 * (Math.pow(15, clamp(e - 4)) - 1) };
}
